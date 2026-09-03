/**
 * =============================================================================
 *  ENVIRONMENT VARIABLE GUARDS
 * =============================================================================
 *
 * Two jobs:
 *   1. Fail loudly when something required is missing, at BUILD time, rather
 *      than at 2am on a live page.
 *   2. Refuse to build at all if a secret has been given a NEXT_PUBLIC_ prefix.
 *
 * WHY (2) IS THE IMPORTANT ONE
 * Anything named NEXT_PUBLIC_* is inlined into the JavaScript bundle that every
 * visitor downloads. A service-role key pasted into NEXT_PUBLIC_SUPABASE_KEY by
 * mistake is not "a leak later" -- it is total, immediate, unauthenticated
 * read/write access to the whole database, published on the internet, with no
 * error message anywhere. It is a one-character mistake in a dashboard field
 * with no undo, so it is checked mechanically instead of remembered.
 *
 * The detection is not name-based, because the name is exactly what the mistake
 * gets wrong. A Supabase key is an unencrypted JWT: base64-decoding its payload
 * and looking for "service_role" catches the key whatever it has been called.
 */

/** Decodes a JWT payload without verifying it. Returns null for non-JWTs. */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    // Base64URL -> Base64. atob exists in both the Node and edge runtimes used
    // here; Buffer does not exist on the edge.
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '='));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function looksLikeServiceRoleKey(value: string): boolean {
  const payload = decodeJwtPayload(value);
  return payload?.role === 'service_role';
}

export class EnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvError';
  }
}

/**
 * Throws if any NEXT_PUBLIC_ variable holds a service-role key.
 *
 * Called from next.config.ts, so it runs on `next build`, on `next dev`, and in
 * CI -- before anything is deployed.
 */
export function assertNoPublicSecrets(env: NodeJS.ProcessEnv = process.env): void {
  const offenders: string[] = [];

  for (const [name, value] of Object.entries(env)) {
    if (!name.startsWith('NEXT_PUBLIC_')) continue;
    if (typeof value !== 'string' || value.length < 40) continue;
    if (looksLikeServiceRoleKey(value)) offenders.push(name);
  }

  if (offenders.length > 0) {
    throw new EnvError(
      `A Supabase SERVICE ROLE key is set on a public variable: ${offenders.join(', ')}.\n` +
        `NEXT_PUBLIC_ variables are compiled into the browser bundle, so this key would be\n` +
        `readable by every visitor and would give them full read/write access to the database.\n\n` +
        `Fix: in Vercel (and in .env.local), rename it to SUPABASE_SERVICE_ROLE_KEY with NO\n` +
        `NEXT_PUBLIC_ prefix, then rotate the key in the Supabase dashboard because the old one\n` +
        `must be assumed compromised.`,
    );
  }
}

/**
 * Throws if a variable the site cannot run without is missing.
 *
 * TURNSTILE_SECRET_KEY is deliberately NOT required: the contact form is built
 * to work without it (see app/actions/contact.ts). Requiring it here would mean
 * the site could not build until Cloudflare had been set up.
 */
export function assertRequiredEnv(env: NodeJS.ProcessEnv = process.env): void {
  // utils/supabase/client.ts carries hardcoded fallbacks for these two, so the
  // site does still boot without them. They are warned about rather than
  // thrown on: turning a working deployment into a failed build over a value
  // that has a fallback would be the wrong trade.
  const recommended = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  const missing = recommended.filter((k) => !env[k]);

  if (missing.length > 0) {
    console.warn(
      `[env] Not set: ${missing.join(', ')}. ` +
        `Falling back to the values hardcoded in utils/supabase/client.ts. ` +
        `Set them in Vercel so the fallback can eventually be deleted.`,
    );
  }
}

/**
 * Reads a server-only secret. Never call this from a component that could run
 * in the browser -- the value would be undefined there, which is a confusing
 * way to find out you are on the wrong side of the boundary.
 */
export function serverSecret(name: string): string | undefined {
  if (typeof window !== 'undefined') {
    throw new EnvError(`serverSecret('${name}') was called in the browser.`);
  }
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}
