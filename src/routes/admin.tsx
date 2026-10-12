import { createFileRoute } from '@tanstack/react-router';
import { AdminDashboard } from '@/components/phonehub/admin-dashboard';
export const Route=createFileRoute('/admin')({
 head:()=>({meta:[{title:'PhoneHub Admin'},{name:'description',content:'Protected PhoneHub inventory and order management. Administrator sign-in required.'},{property:'og:title',content:'PhoneHub Admin'},{property:'og:description',content:'Private PhoneHub admin dashboard. Production access must be protected.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'},{name:'robots',content:'noindex, nofollow'}]}),
 component:AdminDashboard,
});