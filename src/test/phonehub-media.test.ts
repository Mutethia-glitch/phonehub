import { describe, expect, it, vi } from 'vitest';
import { uploadProductImage, validateProductImage, MAX_PRODUCT_IMAGE_BYTES } from '../lib/phonehub/product-images';

const config={url:'https://phonehub.supabase.co',anonKey:'public-key'};
describe('PhoneHub admin image handling',()=>{
 it('rejects unsupported image types and empty files',()=>{
  expect(()=>validateProductImage(new File(['svg'],'photo.svg',{type:'image/svg+xml'}))).toThrow('JPG, PNG or WebP');
  expect(()=>validateProductImage(new File([],'zero.png',{type:'image/png'}))).toThrow('5 MB');
 });
 it('limits files to 5 MiB before sending requests',async()=>{
  const fake={type:'image/png',size:MAX_PRODUCT_IMAGE_BYTES+1} as File;
  const request=vi.fn();
  await expect(uploadProductImage({...config,fetcher:request},'admin-token',fake)).rejects.toThrow('5 MB');
  expect(request).not.toHaveBeenCalled();
 });
 it('requires authorization even for valid files',async()=>{
  const request=vi.fn();
  await expect(uploadProductImage({...config,fetcher:request},'',new File(['a'],'pic.webp',{type:'image/webp'}))).rejects.toThrow('Administrator login required');
  expect(request).not.toHaveBeenCalled();
 });
 it('posts approved images with user JWT, never service-role credentials',async()=>{
  const send=vi.fn(async()=>Response.json({Key:'phonehub-product-images/id.webp'}));
  const url=await uploadProductImage({...config,fetcher:send},'authorized-jwt',new File(['image-data'],'phone.webp',{type:'image/webp'}));
  const [request,options]=send.mock.calls[0] as unknown as [URL,RequestInit];
  expect(request.pathname).toMatch(/^\/storage\/v1\/object\/phonehub-product-images\/[0-9a-f-]+\.webp$/);
  expect((options.headers as Record<string,string>)['Authorization']).toBe('Bearer authorized-jwt');
  expect((options.headers as Record<string,string>)['x-upsert']).toBe('false');
  expect(url).toMatch(/^https:\/\/phonehub\.supabase\.co\/storage\/v1\/object\/public\/phonehub-product-images\/[0-9a-f-]+\.webp$/);
 });
 it('reports provider/storage access denial',async()=>{
  const send=vi.fn(async()=>Response.json({message:'RLS policy violation'},{status:403}));
  const file=new File(['x'],'photo.jpg',{type:'image/jpeg'});
  await expect(uploadProductImage({...config,fetcher:send},'ordinary-user',file)).rejects.toThrow('RLS policy violation');
 });
});
