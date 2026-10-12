import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPhoneHubApi, type CartItem as DbCartItem, type Order as DbOrder, type Product as DbProduct } from '@/lib/phonehub/backend-api';
import { createPhoneHubAuth, type AuthSession } from '@/lib/phonehub/auth-api';

export type Tone = 'silver' | 'blue' | 'black' | 'pink' | 'green' | 'purple' | 'gold' | 'white';
export type Product = {
  id: string; brand: string; name: string; price: number; oldPrice?: number;
  storage: string; camera: string; display: string; tones: Tone[]; shape: string;
  imageUrl?: string; stockQty: number; tag?: string; tagType?: string;
};
export type CartItem = { productId: string; tone: Tone; quantity: number };
export type CustomerOrder = DbOrder;
export const money = (value: number) => 'KSh ' + value.toLocaleString('en-KE');
const tones: Tone[] = ['silver','blue','black','pink','green','purple','gold','white'];
function mapProduct(p: DbProduct): Product {
  const brand = p.brand.toLowerCase();
  const shape = brand.includes('apple') ? 'apple' : brand.includes('samsung') ? 'samsung' :
    brand.includes('xiaomi') || brand.includes('redmi') ? 'xiaomi' :
    brand.includes('tecno') ? 'tecno' : brand.includes('infinix') ? 'infinix' : 'oppo';
  return {
    id: p.id, brand: p.brand, name: p.name, price: p.price_kes,
    ...(p.compare_at_kes ? { oldPrice: p.compare_at_kes } : {}),
    storage: p.storage, camera: p.camera, display: p.display,
    tones: (p.colors.filter((c): c is Tone => tones.includes(c as Tone)).length ?
      p.colors.filter((c): c is Tone => tones.includes(c as Tone)) : ['black']),
    shape, stockQty: p.stock_qty, ...(p.image_url ? { imageUrl:p.image_url } : {})
  };
}
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const configured = Boolean(supabaseUrl && supabaseKey && !supabaseUrl.includes('YOUR-PROJECT'));
const config = configured ? { url:supabaseUrl!, anonKey:supabaseKey! } : null;

type Store = {
  configured: boolean; loading: boolean; error: string | null;
  customer: string | null; accessToken: string | null; products: Product[];
  cart: CartItem[]; orders: CustomerOrder[]; subtotal: number; count: number;
  requestEmailCode: (email:string) => Promise<void>;
  verifyEmailCode: (email:string,code:string) => Promise<void>;
  signOut: () => Promise<void>;
  addItem: (id:string,tone:Tone) => Promise<void>;
  changeQuantity: (id:string,tone:Tone,delta:number) => Promise<void>;
  removeItem: (id:string,tone:Tone) => Promise<void>;
  reload: () => Promise<void>;
  clearError: () => void;
};
const Context = createContext<Store | null>(null);
export function PhoneHubProvider({children}:{children:ReactNode}) {
  const [session,setSession] = useState<AuthSession|null>(null);
  const [products,setProducts] = useState<Product[]>([]);
  const [cart,setCart] = useState<CartItem[]>([]);
  const [orders,setOrders] = useState<CustomerOrder[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState<string|null>(null);
  const api = useCallback((token?:string) => {
    if (!config) throw new Error('Store setup is in progress. Please check back soon.');
    return createPhoneHubApi(config,token);
  },[]);
  const reload = useCallback(async()=>{
    if(!config){setProducts([]);setCart([]);setOrders([]);setLoading(false);return;}
    try {
      setError(null);setLoading(true);
      const listed=await api().products();
      setProducts(listed.map(mapProduct));
      if(session){
        const client=api(session.access_token);
        const [cartRows,orderRows]=await Promise.all([client.cart(),client.myOrders()]);
        setCart(cartRows.map((c:DbCartItem)=>({productId:c.product_id,tone:(tones.includes(c.color as Tone)?c.color:'black') as Tone,quantity:c.quantity})));
        setOrders(orderRows);
      }else {setCart([]);setOrders([]);}
    } catch(e) {setError(e instanceof Error?e.message:'Unable to load store data');}
    finally {setLoading(false);}
  },[api,session]);
  useEffect(()=>{void reload();},[reload]);
  useEffect(()=>{
    // Delete the prior browser-only demo order records; never hydrate mock data.
    try{localStorage.removeItem('phonehub-demo-orders-v1');}catch{/* Storage may be unavailable. */}
  },[]);
  const requestEmailCode=useCallback(async(email:string)=>{
    if(!config)throw new Error('Customer accounts are not available yet.');
    await createPhoneHubAuth(config).requestEmailCode(email);
  },[]);
  const verifyEmailCode=useCallback(async(email:string,code:string)=>{
    if(!config)throw new Error('Customer accounts are not available yet.');
    const auth=await createPhoneHubAuth(config).verifyEmailCode(email,code);
    if(!auth.user?.id || !auth.access_token) throw new Error('Email verification did not create a valid session');
    setSession(auth);
    setError(null);
    // Session only in memory until secure SSR persistence is implemented.
  },[]);
  const signOut=useCallback(async()=>{
    const current=session;
    setSession(null);setCart([]);setOrders([]);
    if(config && current){try{await createPhoneHubAuth(config).signOut(current.access_token);}catch {/* Local logout still applies. */}}
  },[session]);
  const addItem=useCallback(async(id:string,tone:Tone)=>{
    if(!session)throw new Error('Please verify your email to add products.');
    const product=products.find(p=>p.id===id);
    if(!product||product.stockQty<1)throw new Error('This product is unavailable.');
    const existing=cart.find(c=>c.productId===id&&c.tone===tone);
    const qty=(existing?.quantity||0)+1;
    if(qty>product.stockQty)throw new Error('Not enough stock available.');
    await api(session.access_token).setCartItem(session.user.id,id,tone,qty);
    setCart(prev=>existing?prev.map(c=>c.productId===id&&c.tone===tone?{...c,quantity:qty}:c):[...prev,{productId:id,tone,quantity:1}]);
  },[session,cart,products,api]);
  const changeQuantity=useCallback(async(id:string,tone:Tone,delta:number)=>{
    if(!session)throw new Error('Please sign in.');
    const existing=cart.find(c=>c.productId===id&&c.tone===tone);
    if(!existing)return;
    const next=Math.max(1,Math.min(20,existing.quantity+delta));
    const product=products.find(p=>p.id===id);
    if(product && next>product.stockQty)throw new Error('Not enough stock.');
    await api(session.access_token).setCartItem(session.user.id,id,tone,next);
    setCart(prev=>prev.map(c=>c.productId===id&&c.tone===tone?{...c,quantity:next}:c));
  },[session,cart,products,api]);
  const removeItem=useCallback(async(id:string,tone:Tone)=>{
    if(!session)throw new Error('Please sign in.');
    // Supabase's user-scoped RLS is the authority for all cart mutations.
    const rows=await api(session.access_token).cart();
    const entry=rows.find(c=>c.product_id===id&&c.color===tone);
    if(entry)await api(session.access_token).removeCartItem(entry.id);
    setCart(prev=>prev.filter(c=>!(c.productId===id&&c.tone===tone)));
  },[session,api]);
  const subtotal=useMemo(()=>cart.reduce((sum,c)=>sum+(products.find(p=>p.id===c.productId)?.price||0)*c.quantity,0),[cart,products]);
  const value:Store={configured,loading,error,customer:session?.user.email||null,accessToken:session?.access_token||null,products,
    cart,orders,subtotal,count:cart.reduce((n,c)=>n+c.quantity,0),requestEmailCode,verifyEmailCode,signOut,
    addItem,changeQuantity,removeItem,reload,clearError:()=>setError(null)};
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function usePhoneHubStore(){const value=useContext(Context);if(!value)throw new Error('PhoneHubProvider is required');return value;}
