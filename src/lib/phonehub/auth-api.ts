/**
 * Passwordless email login helpers using Supabase Auth HTTP endpoints.
 * OTP emails require the Supabase email template to include {{ .Token }}.
 * Never send credentials, refresh tokens, or card data to analytics/logging.
 * Callers must handle sessions securely; this module does not persist tokens.
 */
import type { PhoneHubConfig } from './backend-api';

export type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user: { id: string; email: string };
};
export class PhoneHubAuthError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name='PhoneHubAuthError'; }
}
export function createPhoneHubAuth(config: PhoneHubConfig) {
  const base = new URL(config.url);
  if (base.protocol !== 'https:' && !['localhost','127.0.0.1'].includes(base.hostname))
    throw new Error('Authentication endpoint must use HTTPS');
  const send = config.fetcher ?? fetch;
  async function call<T>(path:string, body:Record<string,unknown>, jwt?:string):Promise<T> {
    const result = await send(new URL(path,base.origin),{
      method:'POST',headers:{
        apikey:config.anonKey,
        'Content-Type':'application/json',
        ...(jwt?{Authorization:'Bearer '+jwt}:{})
      },body:JSON.stringify(body)
    });
    const data = await result.json().catch(()=>({})) as T & { msg?:string; error_description?:string; message?:string };
    if(!result.ok) throw new PhoneHubAuthError(
      data.error_description || data.msg || data.message || 'Authentication request failed',
      result.status
    );
    return data;
  }
  function validEmail(email:string) {
    const clean=email.trim().toLowerCase();
    if (clean.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new Error('Valid email required');
    return clean;
  }
  return {
    requestEmailCode: async (email:string) =>
      call<Record<string,unknown>>('/auth/v1/otp',{ email:validEmail(email),create_user:true }),
    verifyEmailCode: async (email:string,code:string) => {
      if (!/^[0-9]{6,8}$/.test(code)) throw new Error('Invalid email verification code');
      return call<AuthSession>('/auth/v1/verify',{ email:validEmail(email),token:code,type:'email' });
    },
    refreshSession: async (refreshToken:string) => {
      if (!refreshToken) throw new Error('Refresh token required');
      return call<AuthSession>('/auth/v1/token?grant_type=refresh_token',{ refresh_token:refreshToken });
    },
    signOut: async (accessToken:string) => {
      if (!accessToken) throw new Error('Access token required');
      return call<Record<string,unknown>>('/auth/v1/logout',{},accessToken);
    }
  };
}
