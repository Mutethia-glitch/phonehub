import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Tone = 'silver' | 'blue' | 'black' | 'pink' | 'green' | 'purple' | 'gold' | 'white';
export type Product = { id: string; brand: string; name: string; price: number; oldPrice?: number; storage: string; camera: string; display: string; tones: Tone[]; tag?: string; tagType?: string; shape: string };
export const products: Product[] = [
 { id:'s24',brand:'Samsung',name:'Galaxy S24 Ultra',price:149999,oldPrice:169999,storage:'256GB',camera:'200MP',display:'6.8″ AMOLED',tones:['silver','black','purple'],tag:'Bestseller',shape:'samsung' },
 { id:'i15',brand:'Apple',name:'iPhone 15 Pro',price:154999,oldPrice:174999,storage:'256GB',camera:'48MP',display:'6.1″ Super Retina',tones:['blue','silver','black'],tag:'Save KSh 20,000',tagType:'sale',shape:'apple' },
 { id:'redmi',brand:'Xiaomi/Redmi',name:'Redmi Note 13 Pro+',price:46999,storage:'256GB',camera:'200MP',display:'6.67″ AMOLED',tones:['purple','white','black'],tag:'Great value',tagType:'hot',shape:'xiaomi' },
 { id:'camon',brand:'Tecno',name:'Camon 30 Premier',price:58999,storage:'512GB',camera:'50MP',display:'6.77″ AMOLED',tones:['green','silver','black'],shape:'tecno' },
 { id:'a55',brand:'Samsung',name:'Galaxy A55 5G',price:49999,oldPrice:54999,storage:'128GB',camera:'50MP',display:'6.6″ AMOLED',tones:['blue','purple','black'],tag:'Everyday favourite',shape:'samsung' },
 { id:'i15base',brand:'Apple',name:'iPhone 15',price:109999,storage:'128GB',camera:'48MP',display:'6.1″ Super Retina',tones:['pink','green','black'],shape:'apple' },
 { id:'note40',brand:'Infinix',name:'Note 40 Pro',price:34999,oldPrice:38999,storage:'256GB',camera:'108MP',display:'6.78″ AMOLED',tones:['gold','green','black'],tag:'Hot deal',tagType:'sale',shape:'infinix' },
 { id:'reno',brand:'OPPO',name:'Reno11 5G',price:62999,storage:'256GB',camera:'50MP',display:'6.7″ AMOLED',tones:['green','white','black'],shape:'oppo' },
];
export const money = (n:number) => `KSh ${n.toLocaleString('en-KE')}`;
export type CartItem = { productId: string; tone: Tone; quantity: number };
export type DemoOrder = { id:string; transactionId:string; email:string; name:string; city:string; items:CartItem[]; total:number; status:'success'|'failed'; time:string; brand:string; last4:string; country:string; failure?:string };
const seedOrders: DemoOrder[] = [
 {id:'PH-DEMO-1002',transactionId:'txn_demo_8f42a1',email:'amina@example.test',name:'Amina K.',city:'Nairobi',items:[{productId:'s24',tone:'silver',quantity:1}],total:149999,status:'success',time:'2026-10-12T11:42:00Z',brand:'Visa',last4:'4242',country:'KE'},
 {id:'PH-DEMO-1001',transactionId:'txn_demo_5c91b3',email:'brian@example.test',name:'Brian M.',city:'Mombasa',items:[{productId:'reno',tone:'green',quantity:1}],total:62999,status:'failed',time:'2026-10-12T10:18:00Z',brand:'Mastercard',last4:'4444',country:'KE',failure:'Simulated issuer decline. No charge was made.'}
];
type DemoContextValue = { customer:string|null; setCustomer:(email:string|null)=>void; cart:CartItem[]; addItem:(id:string,tone:Tone)=>void; changeQuantity:(id:string,tone:Tone,delta:number)=>void; removeItem:(id:string,tone:Tone)=>void; clearCart:()=>void; orders:DemoOrder[]; recordOrder:(order:DemoOrder)=>void; subtotal:number; count:number };
const DemoContext = createContext<DemoContextValue|null>(null);
export function DemoProvider({children}:{children:ReactNode}) {
 const [customer,setCustomer] = useState<string|null>(null);
 const [cart,setCart] = useState<CartItem[]>([]);
 const [orders,setOrders] = useState<DemoOrder[]>(seedOrders);
 const [loaded,setLoaded] = useState(false);
 useEffect(()=>{ try { const saved=localStorage.getItem('phonehub-demo-orders-v1'); if(saved) { const parsed=JSON.parse(saved); if(Array.isArray(parsed) && parsed.every(o=>typeof o.id==='string' && Array.isArray(o.items) && (o.status==='success'||o.status==='failed'))) setOrders(parsed); } } catch { /* Local preview storage may be unavailable. */ } setLoaded(true); },[]);
 useEffect(()=>{if(loaded) {try {localStorage.setItem('phonehub-demo-orders-v1',JSON.stringify(orders));}catch {/* Remains functional in memory. */}}},[orders,loaded]);
 const addItem=(productId:string,tone:Tone)=>setCart(prev=>{const found=prev.find(x=>x.productId===productId&&x.tone===tone);return found?prev.map(x=>x===found?{...x,quantity:x.quantity+1}:x):[...prev,{productId,tone,quantity:1}];});
 const changeQuantity=(id:string,tone:Tone,delta:number)=>setCart(prev=>prev.map(x=>x.productId===id&&x.tone===tone?{...x,quantity:Math.max(1,Math.min(99,x.quantity+delta))}:x));
 const removeItem=(id:string,tone:Tone)=>setCart(prev=>prev.filter(x=>!(x.productId===id&&x.tone===tone)));
 const subtotal=cart.reduce((sum,x)=>sum+(products.find(p=>p.id===x.productId)?.price??0)*x.quantity,0);
 return <DemoContext.Provider value={{customer,setCustomer,cart,addItem,changeQuantity,removeItem,clearCart:()=>setCart([]),orders,recordOrder:o=>setOrders(prev=>[o,...prev]),subtotal,count:cart.reduce((n,x)=>n+x.quantity,0)}}>{children}</DemoContext.Provider>;
}
export function useDemoStore(){ const value=useContext(DemoContext); if(!value)throw new Error('DemoProvider is required'); return value; }