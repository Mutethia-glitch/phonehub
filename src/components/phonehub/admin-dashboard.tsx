import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, CreditCard, LayoutDashboard, ShoppingBag, Smartphone, ShieldAlert, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { money, usePhoneHubStore } from './store-provider';
import { createPhoneHubApi, type Product, type Order, type ProductInput } from '@/lib/phonehub/backend-api';

const pages=[{title:'Overview',icon:LayoutDashboard},{title:'Products',icon:Smartphone},{title:'Orders',icon:ShoppingBag},{title:'Payments',icon:CreditCard}];
const formDefaults:ProductInput={slug:'',brand:'',name:'',description:'',storage:'',camera:'',display:'',image_url:null,colors:['black'],price_kes:0,compare_at_kes:null,stock_qty:0,is_published:false};

export function AdminDashboard(){
 const store=usePhoneHubStore();
 const [allowed,setAllowed]=useState(false),[checking,setChecking]=useState(true);
 const [error,setError]=useState<string|null>(null),[page,setPage]=useState('Overview');
 const [items,setItems]=useState<Product[]>([]),[orders,setOrders]=useState<Order[]>([]);
 const [edit,setEdit]=useState<(ProductInput & {id?:string})|null>(null),[saving,setSaving]=useState(false);
 const api=useMemo(()=>store.accessToken&&store.configured?createPhoneHubApi({url:import.meta.env.VITE_SUPABASE_URL as string,anonKey:import.meta.env.VITE_SUPABASE_ANON_KEY as string},store.accessToken):null,[store.accessToken,store.configured]);
 useEffect(()=>{
   let active=true;
   if(!api){setAllowed(false);setChecking(false);setItems([]);setOrders([]);return;}
   setChecking(true);
   void (async()=>{try{
      const authorized=await api.isAdmin();
      if(!active)return;
      setAllowed(authorized);
      if(authorized){const [catalog,history]=await Promise.all([api.adminProducts(),api.adminOrders()]);if(active){setItems(catalog);setOrders(history);}}
   }catch(e){if(active){setAllowed(false);setError(e instanceof Error?e.message:'Access verification failed');}}finally{if(active)setChecking(false);}})();
   return()=>{active=false;};
 },[api]);
 const reload=async()=>{if(!api||!allowed)return;const [p,o]=await Promise.all([api.adminProducts(),api.adminOrders()]);setItems(p);setOrders(o);};
 async function save(e:FormEvent){
  e.preventDefault();if(!api||!edit)return;setSaving(true);setError(null);
  const {id,...model}=edit;
  try{if(id)await api.editAdminProduct(id,model);else await api.addAdminProduct(model);await reload();setEdit(null);}
  catch(err){setError(err instanceof Error?err.message:'Saving failed');}finally{setSaving(false);}
 }
 if(!store.configured||checking||!allowed)return <main className="min-h-screen flex flex-col items-center justify-center px-5 text-center">
  <ShieldAlert className="size-10 mb-4 text-muted-foreground"/>
  <h1 className="text-2xl font-bold">{!store.configured?'Admin configuration pending':checking?'Checking administrator access':'Administrator access required'}</h1>
  <p className="text-sm text-muted-foreground max-w-md mt-3">{error||'Sign in with an authorized administrator email to manage products and orders.'}</p>
  <Button asChild className="mt-6"><Link to="/">Return to PhoneHub</Link></Button>
 </main>;
 const paid=orders.filter(o=>o.status==='paid'||o.status==='fulfilled');
 const metrics=[['Paid revenue',money(paid.reduce((n,o)=>n+o.total_kes,0))],['Orders',String(orders.length)],['Products',String(items.length)],['Paid orders',String(paid.length)]];
 return <div className="admin-layout"><aside className="admin-sidebar">
  <Link to="/" className="wordmark text-[25px]">PhoneHub<span className="wordmark-dot">.</span></Link>
  <span className="eyebrow text-admin-muted">Store workspace</span>
  <nav className="space-y-2">{pages.map(v=><Button key={v.title} variant="admin" className={['admin-nav-item','h-11',page===v.title?'active':''].join(' ')} onClick={()=>setPage(v.title)}><v.icon/>{v.title}</Button>)}</nav>
  <div className="sidebar-bottom mt-auto"><span className="text-xs text-admin-muted">{store.customer}</span><Button asChild variant="admin" className="w-full mt-5"><Link to="/"><ArrowLeft/>Back to store</Link></Button></div>
 </aside><main className="admin-main">
  <div className="flex items-center justify-between"><div><p className="text-[10px] text-muted-foreground mb-2">PHONEHUB / {page.toUpperCase()}</p><h1 className="text-3xl font-bold">{page==='Overview'?'Store overview':page}</h1></div><Button variant="outline" onClick={()=>void reload()}>Refresh</Button></div>
  {error&&<p role="alert" className="text-sm text-destructive mt-4">{error}</p>}
  {page==='Overview'&&<><div className="metrics-grid">{metrics.map(m=><div className="metric" key={m[0]}><p className="text-xs text-muted-foreground">{m[0]}</p><p className="metric-number">{m[1]}</p></div>)}</div><h2 className="font-bold mt-7">Recent orders</h2>{orderTable(orders.slice(0,8))}</>}
  {page==='Products'&&<><div className="flex justify-between items-center mt-7 mb-5"><span className="text-sm text-muted-foreground">{items.length} products in database</span><Button onClick={()=>setEdit({...formDefaults})}><Plus/>Add phone</Button></div><div className="admin-table-wrap"><table className="data-table"><thead><tr><th>PHONE</th><th>BRAND</th><th>PRICE</th><th>STOCK</th><th>STATUS</th><th></th></tr></thead><tbody>{items.map(p=><tr key={p.id}><td>{p.name}</td><td>{p.brand}</td><td>{money(p.price_kes)}</td><td>{p.stock_qty}</td><td>{p.is_published?'Published':'Draft'}</td><td><Button size="sm" variant="ghost" onClick={()=>setEdit({...p})}>Edit</Button></td></tr>)}</tbody></table>{!items.length&&<p className="text-sm text-muted-foreground text-center py-10">No real products added yet.</p>}</div></>}
  {page==='Orders'&&orderTable(orders)}
  {page==='Payments'&&<div className="admin-table-wrap p-8 mt-8 text-center"><CreditCard className="mx-auto mb-4 text-muted-foreground"/><h2 className="text-lg font-bold">Payments not configured</h2><p className="text-sm text-muted-foreground mt-3">No fake payment results are displayed. Provider-verified payment records will appear here once Stripe or Paystack is connected.</p></div>}
 </main>
 <Dialog open={Boolean(edit)} onOpenChange={v=>{if(!v)setEdit(null);}}><DialogContent className="max-w-md modal-scroll"><DialogTitle>{edit?.id?'Edit product':'New product'}</DialogTitle><DialogDescription>Saved to your private PhoneHub database.</DialogDescription>{edit&&<form onSubmit={save} className="space-y-3">
  <label className="text-xs block">Name<Input required className="mt-1" value={edit.name} onChange={e=>setEdit({...edit,name:e.target.value})}/></label>
  <label className="text-xs block">Slug<Input required pattern="[a-z0-9]+(-[a-z0-9]+)*" className="mt-1" value={edit.slug} onChange={e=>setEdit({...edit,slug:e.target.value})}/></label>
  <label className="text-xs block">Brand<Input required className="mt-1" value={edit.brand} onChange={e=>setEdit({...edit,brand:e.target.value})}/></label>
  <div className="grid grid-cols-2 gap-3"><label className="text-xs">Price KSh<Input required type="number" min="1" step="1" className="mt-1" value={edit.price_kes} onChange={e=>setEdit({...edit,price_kes:Number(e.target.value)})}/></label><label className="text-xs">Stock<Input required type="number" min="0" step="1" className="mt-1" value={edit.stock_qty} onChange={e=>setEdit({...edit,stock_qty:Number(e.target.value)})}/></label></div>
  <label className="text-xs block">Storage<Input className="mt-1" value={edit.storage} onChange={e=>setEdit({...edit,storage:e.target.value})}/></label>
  <label className="text-xs block">Camera<Input className="mt-1" value={edit.camera} onChange={e=>setEdit({...edit,camera:e.target.value})}/></label>
  <label className="text-xs block">Display<Input className="mt-1" value={edit.display} onChange={e=>setEdit({...edit,display:e.target.value})}/></label>
  <label className="text-xs block">Image URL<Input className="mt-1" value={edit.image_url||''} onChange={e=>setEdit({...edit,image_url:e.target.value||null})}/></label>
  <label className="text-xs flex gap-2 items-center"><input type="checkbox" checked={edit.is_published} onChange={e=>setEdit({...edit,is_published:e.target.checked})}/>Publish product</label>
  <Button type="submit" className="w-full" disabled={saving}>{saving?'Saving…':'Save phone'}</Button>
 </form>}</DialogContent></Dialog>
 </div>;
 function orderTable(data:Order[]){return <div className="admin-table-wrap mt-5"><table className="data-table"><thead><tr><th>ORDER</th><th>CUSTOMER</th><th>PHONE(S)</th><th>AMOUNT</th><th>STATUS</th></tr></thead><tbody>{data.map(o=><tr key={o.id}><td>{o.id.slice(0,8)}</td><td>{o.customer_email}</td><td>{o.order_items?.map(i=>i.product_name+' × '+i.quantity).join(', ')}</td><td>{money(o.total_kes)}</td><td>{o.status.replaceAll('_',' ')}</td></tr>)}</tbody></table>{!data.length&&<p className="py-10 text-center text-muted-foreground text-sm">No orders yet.</p>}</div>;}
}
