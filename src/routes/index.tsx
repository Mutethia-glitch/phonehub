import { createFileRoute } from '@tanstack/react-router';
import { Storefront } from '@/components/phonehub/storefront';
export const Route = createFileRoute('/')({
 head:()=>({meta:[{title:'PhoneHub — Your next phone starts here'},{name:'description',content:'Explore top smartphone brands in PhoneHub’s Kenyan multi-brand smartphone store. Sample prices, demo shopping and no real payments.'},{property:'og:title',content:'PhoneHub — Your next phone starts here'},{property:'og:description',content:'Top brands. Better choices. A premium Kenyan smartphone store storefront with a secure account experience.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),
 component: Storefront,
});