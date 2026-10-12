import { createFileRoute } from '@tanstack/react-router';
import { AdminDashboard } from '@/components/phonehub/admin-dashboard';
export const Route=createFileRoute('/admin')({
 head:()=>({meta:[{title:'PhoneHub Admin — Demo workspace'},{name:'description',content:'PhoneHub admin UI demonstration with mock products, orders and masked simulated payment results. Not authenticated.'},{property:'og:title',content:'PhoneHub Admin — Demo workspace'},{property:'og:description',content:'Mock store management and simulated payment activity. Production access must be protected.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'},{name:'robots',content:'noindex, nofollow'}]}),
 component:AdminDashboard,
});