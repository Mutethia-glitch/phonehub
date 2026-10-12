import type { PhoneHubConfig } from './backend-api';

export const PRODUCT_IMAGE_BUCKET = 'phonehub-product-images';
export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
const allowed = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

/** Checks file type and size before any network request; Supabase Storage applies
 * equivalent bucket-level limits. Only a server-approved admin JWT can upload. */
export function validateProductImage(file: Pick<File, 'size' | 'type'>): string {
  const ext = allowed.get(file.type);
  if (!ext) throw new Error('Choose a JPG, PNG or WebP image.');
  if (file.size <= 0 || file.size > MAX_PRODUCT_IMAGE_BYTES)
    throw new Error('Image size must be between 1 byte and 5 MB.');
  return ext;
}

export async function uploadProductImage(
  config: PhoneHubConfig,
  adminAccessToken: string,
  image: File,
): Promise<string> {
  if (!adminAccessToken) throw new Error('Administrator login required.');
  const extension = validateProductImage(image);
  const origin = new URL(config.url);
  if (origin.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(origin.hostname))
    throw new Error('Supabase storage requires HTTPS.');
  if (!config.anonKey) throw new Error('Supabase publishable key is missing.');

  // Unique path; never accept user-supplied object names or overwrite existing media.
  const objectName = crypto.randomUUID() + '.' + extension;
  const relativePath = '/storage/v1/object/' + PRODUCT_IMAGE_BUCKET + '/' + objectName;
  const request = config.fetcher ?? fetch;
  const response = await request(new URL(relativePath, origin.origin), {
    method: 'POST',
    headers: {
      apikey: config.anonKey,
      Authorization: 'Bearer ' + adminAccessToken,
      'Content-Type': image.type,
      'x-upsert': 'false',
      'cache-control': 'max-age=3600',
    },
    body: image,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { message?: string; error?: string };
    throw new Error(data.message || data.error || 'Image upload failed.');
  }
  return new URL('/storage/v1/object/public/' + PRODUCT_IMAGE_BUCKET + '/' + objectName, origin.origin).toString();
}
