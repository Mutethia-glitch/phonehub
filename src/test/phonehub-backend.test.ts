import { describe, expect, it, vi } from 'vitest';
import { createPhoneHubApi, PhoneHubApiError } from '../lib/phonehub/backend-api';
import { createPhoneHubAuth } from '../lib/phonehub/auth-api';

const base={url:'https://example.supabase.co',anonKey:'public-test-key'};
const userId='11111111-1111-4111-8111-111111111111';
const productId='22222222-2222-4222-8222-222222222222';
const cartId='33333333-3333-4333-8333-333333333333';
const ok=(value:unknown)=>Response.json(value,{status:200});

describe('PhoneHub protected API',()=>{
 it('reads the public catalog without a login',async()=>{
  const mock=vi.fn(async()=>ok([]));
  const api=createPhoneHubApi({...base,fetcher:mock});
  expect(await api.products()).toEqual([]);
  const [url,options]=mock.mock.calls[0] as unknown as [URL,RequestInit];
  expect(url.pathname).toBe('/rest/v1/products');
  expect(url.searchParams.get('is_published')).toBe('eq.true');
  expect((options.headers as Record<string,string>)['apikey']).toBe('public-test-key');
 });
 it('refuses guest cart updates and order creation',async()=>{
  const api=createPhoneHubApi({...base,fetcher:vi.fn()});
  await expect(api.createPendingOrder({name:'Test',phone:'0712345678',zoneId:productId,address:'Westlands'})).rejects.toThrow('Login required');
  expect(() => api.removeCartItem(cartId)).toThrow('Login required');
 });
 it('does not accept client-supplied totals or paid statuses at checkout',async()=>{
  const mock=vi.fn(async()=>ok([{order_id:cartId,total_kes:999}]));
  const api=createPhoneHubApi({...base,fetcher:mock},'customer-jwt');
  const result=await api.createPendingOrder({name:'Mary',phone:'0712345678',zoneId:productId,address:'CBD'});
  expect(result.total_kes).toBe(999);
  const [url,options]=mock.mock.calls[0] as unknown as [URL,RequestInit];
  expect(url.pathname).toBe('/rest/v1/rpc/phonehub_create_pending_order');
  expect(JSON.parse(options.body as string)).toEqual({
   p_name:'Mary',p_phone:'0712345678',p_zone_id:productId,p_address:'CBD'
  });
  expect((options.headers as Record<string,string>)['Authorization']).toBe('Bearer customer-jwt');
 });
 it('uses customer-scoped cart upsert and rejects invalid quantities',async()=>{
  const mock=vi.fn(async()=>ok([{id:cartId,product_id:productId,color:'black',quantity:2,products:null}]));
  const api=createPhoneHubApi({...base,fetcher:mock},'customer-jwt');
  await expect(api.setCartItem(userId,productId,'black',21)).rejects.toThrow('Invalid quantity');
  await api.setCartItem(userId,productId,'black',2);
  const [url,options]=mock.mock.calls[0] as unknown as [URL,RequestInit];
  expect(url.searchParams.get('on_conflict')).toBe('user_id,product_id,color');
  expect(JSON.parse(options.body as string)).toEqual({user_id:userId,product_id:productId,color:'black',quantity:2});
 });
 it('propagates RLS permission errors without masking them as success',async()=>{
  const mock=vi.fn(async()=>Response.json({message:'forbidden'},{status:403}));
  const api=createPhoneHubApi({...base,fetcher:mock},'ordinary-user-jwt');
  await expect(api.addAdminProduct({slug:'new',brand:'Test',name:'Phone',price_kes:9000,stock_qty:0,is_published:false,image_url:null,storage:'',camera:'',display:'',colors:[],description:'',compare_at_kes:null}))
   .rejects.toBeInstanceOf(PhoneHubApiError);
 });
});

 it('only lists enabled shipping destinations for shoppers',async()=>{
  const mock=vi.fn(async()=>ok([]));
  const api=createPhoneHubApi({...base,fetcher:mock});
  await api.deliveryZones();
  const [url]=mock.mock.calls[0] as unknown as [URL,RequestInit];
  expect(url.pathname).toBe('/rest/v1/delivery_zones');
  expect(url.searchParams.get('is_enabled')).toBe('eq.true');
 });
 it('requires admin login for shipping management and forwards database authorization',async()=>{
  const mock=vi.fn(async()=>Response.json({message:'access denied'},{status:403}));
  const guest=createPhoneHubApi({...base,fetcher:mock});
  await expect(guest.addDeliveryZone({code:'nairobi',name:'Nairobi',fee_kes:350,estimated_days:2,is_enabled:false})).rejects.toThrow('Login required');
  const account=createPhoneHubApi({...base,fetcher:mock},'nonadmin-jwt');
  await expect(account.addDeliveryZone({code:'nairobi',name:'Nairobi',fee_kes:350,estimated_days:2,is_enabled:false})).rejects.toBeInstanceOf(PhoneHubApiError);
 });

describe('PhoneHub passwordless auth',()=>{
 it('requests an email OTP without storing a password or token',async()=>{
  const mock=vi.fn(async()=>ok({}));
  const auth=createPhoneHubAuth({...base,fetcher:mock});
  await auth.requestEmailCode(' Foo@Example.COM ');
  const [url,options]=mock.mock.calls[0] as unknown as [URL,RequestInit];
  expect(url.pathname).toBe('/auth/v1/otp');
  expect(JSON.parse(options.body as string).email).toBe('foo@example.com');
 });
 it('rejects malformed OTP codes locally',async()=>{
  const auth=createPhoneHubAuth({...base,fetcher:vi.fn()});
  await expect(auth.verifyEmailCode('foo@example.com','123')).rejects.toThrow('Invalid email verification code');
 });
});
