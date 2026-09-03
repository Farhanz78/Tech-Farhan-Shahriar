---
name: enterprise-security
description: Master security standards and best practices for Next.js + Supabase applications. Applies to all new apps, games, and portfolios.
---

# Enterprise Security Standards

When building or updating websites, games, or apps (especially with Next.js and Supabase), YOU MUST enforce these enterprise-grade security measures by default to protect against bots, scrapers, and hackers.

## 1. Next.js Configuration (next.config.mjs)
Always disable framework fingerprints and source maps in production, and add strict security headers:
```javascript
export default {
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
      ],
    }];
  },
};
```

## 2. Middleware & Bot Blocking
Always implement a `middleware.ts` that:
1. Blocks common scraping User-Agents (HTTrack, Wget, curl, Python-requests, scrapy, aiohttp).
2. Generates a dynamic cryptographic nonce (`crypto.randomUUID()`) and injects a Strict Content-Security-Policy (CSP).
3. CSP must include: `script-src 'self' 'nonce-{nonce}' 'strict-dynamic';`.

## 3. Supabase Row Level Security (RLS)
- EVERY table must have RLS explicitly enabled:
  ```sql
  ALTER TABLE public.table_name ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.table_name FORCE ROW LEVEL SECURITY;
  ```
- RLS policies MUST use `(SELECT auth.uid()) = user_id` (wrapped in SELECT for query optimization), NEVER `auth.uid() = user_id` directly, which evaluates per row.

## 4. Server Actions Authentication
Every Server Action must validate the user and payload before executing:
```typescript
'use server';
import { createServerClient } from '@/utils/supabase/server';
import { z } from 'zod';

export async function secureAction(data: unknown) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  
  const validated = Schema.safeParse(data);
  if (!validated.success) throw new Error('Invalid input');
  // ... execute
}
```

## 5. Environment Variables Rule
- Never prefix `SUPABASE_SERVICE_ROLE_KEY` or any private key with `NEXT_PUBLIC_`.
- Add runtime checks to throw errors if critical server-side env vars are missing.

## 6. Honeypot & CAPTCHA
- Add an invisible link `<a href="/api/canary" style="display:none" aria-hidden="true">` to trap recursive crawlers (ban IP on hit).
- Use Cloudflare Turnstile for public forms. Verify the token server-side before processing the form.
