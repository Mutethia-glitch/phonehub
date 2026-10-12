/** PhoneHub data access. Supabase's PostgreSQL RLS is the authorization boundary.
 * Never use the service-role key or accept card PAN/CVV here.
 * The caller obtains and refreshes the user access token through verified auth.
 */
export type PhoneHubConfig = { url: string; anonKey: string; fetcher?: typeof fetch };
export type Product = { id: string; slug: string; brand: string; name: string; price_kes: number; stock_qty: number; is_published: boolean; image_url: string|null; storage: string; camera: string; display: string; colors: string[]; description: string; compare_at_kes: number|null };
export type CartItem = { id: string; product_id: string; color: string; quantity: number; products: Product|null };
export type PendingOrder = { order_id: string; total_kes: number };
export type Order = { id: string; user_id: string; customer_email: string|null; customer_name: string; delivery_city: string; total_kes: number; status: string; created_at: string; order_items: Array<{ product_name: string; quantity: number; color: string; unit_price_kes: number }> };
export type Delivery = { name: string; phone: string; city: string; address: string };
export type ProductInput = Omit<Product,'id'>;

export class PhoneHubApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message); this.name = 'PhoneHubApiError';
  }
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function createPhoneHubApi(config: PhoneHubConfig, accessToken?: string) {
  const base = new URL(config.url);
  if (base.protocol !== 'https:' && !['localhost','127.0.0.1'].includes(base.hostname)) throw new Error('HTTPS required');
  if (!config.anonKey) throw new Error('Missing Supabase public key');
  const send = config.fetcher ?? fetch;
  const token = accessToken || config.anonKey;
  function requireLogin() { if (!accessToken) throw new Error('Login required'); }
  async function request<T>(path: string, method = 'GET', body?: unknown, prefer?: string): Promise<T> {
    const response = await send(new URL(path, base.origin), {
      method, headers: {
        apikey: config.anonKey, Authorization: 'Bearer '+token,
        'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {})
      }, ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    if (!response.ok) {
      const problem = await response.json().catch(()=>({})) as { message?: string };
      throw new PhoneHubApiError(problem.message || 'Request failed', response.status);
    }
    if (response.status === 204) return undefined as T;
    const raw = await response.text();
    return (raw ? JSON.parse(raw) : undefined) as T;
  }
  const withId = (id:string) => { if (!uuid.test(id)) throw new Error('Invalid ID'); return id; };
  return {
    products: () => request<Product[]>('/rest/v1/products?select=*&is_published=eq.true&order=name.asc'),
    adminProducts: () => { requireLogin(); return request<Product[]>('/rest/v1/products?select=*&order=created_at.desc'); },
    currentUser: () => { requireLogin(); return request<{ id:string; email:string }>('/auth/v1/user'); },
    isAdmin: () => { requireLogin(); return request<boolean>('/rest/v1/rpc/is_phonehub_admin','POST',{}); },
    cart: () => { requireLogin(); return request<CartItem[]>('/rest/v1/cart_items?select=id,product_id,color,quantity,products(*)&order=updated_at.desc'); },
    async setCartItem(userId:string, productId:string, color:string, quantity:number):Promise<CartItem> {
      requireLogin(); withId(userId); withId(productId);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new Error('Invalid quantity');
      if (color.length > 80) throw new Error('Invalid colour');
      const rows = await request<CartItem[]>('/rest/v1/cart_items?on_conflict=user_id,product_id,color&select=id,product_id,color,quantity,products(*)',
        'POST',{user_id:userId,product_id:productId,color,quantity},'resolution=merge-duplicates,return=representation');
      if (!rows[0]) throw new Error('Cart could not be updated');
      return rows[0];
    },
    removeCartItem: (id:string) => { requireLogin(); return request<void>('/rest/v1/cart_items?id=eq.'+withId(id),'DELETE'); },
    async createPendingOrder(data:Delivery):Promise<PendingOrder> {
      requireLogin();
      const rows = await request<PendingOrder[]>('/rest/v1/rpc/phonehub_create_pending_order','POST',{
        p_name:data.name,p_phone:data.phone,p_city:data.city,p_address:data.address
      });
      if (!rows[0]) throw new Error('Pending order not created');
      return rows[0];
    },
    myOrders: () => { requireLogin(); return request<Order[]>('/rest/v1/orders?select=*,order_items(*)&order=created_at.desc'); },
    adminOrders: () => { requireLogin(); return request<Order[]>('/rest/v1/orders?select=*,order_items(*)&order=created_at.desc'); },
    async addAdminProduct(input:ProductInput):Promise<Product> {
      requireLogin();
      const rows = await request<Product[]>('/rest/v1/products?select=*','POST',input,'return=representation');
      if (!rows[0]) throw new Error('Product not created');
      return rows[0];
    },
    async editAdminProduct(id:string, patch:Partial<ProductInput>):Promise<Product> {
      requireLogin();
      const rows = await request<Product[]>('/rest/v1/products?id=eq.'+withId(id)+'&select=*','PATCH',patch,'return=representation');
      if (!rows[0]) throw new Error('Product not found or forbidden');
      return rows[0];
    }
  };
}
