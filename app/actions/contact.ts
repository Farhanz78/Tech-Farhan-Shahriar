'use server';

import { z } from 'zod';
import { supabase } from '@/utils/supabase/client';
import { serverSecret } from '@/lib/env';
import { sendViaResend, whenLabel } from '@/lib/contact-email';

/**
 * =============================================================================
 *  CONTACT FORM SERVER ACTION
 * =============================================================================
 *
 * DELIBERATE DEVIATION FROM THE HOUSE RULE, STATED UP FRONT.
 * The project security rule is "every Server Action calls supabase.auth.getUser()
 * first and throws Unauthorized if there is no user". That rule is right for
 * every action that touches the owner's data. It cannot apply here: this is the
 * PUBLIC contact form. Requiring a logged-in user would mean a prospective
 * client has to create an account before they can say hello, which defeats the
 * only commercial purpose the site has.
 *
 * So this action is intentionally unauthenticated, and everything that would
 * normally be covered by "is this a real user" is covered instead by four
 * independent gates, each of which fails closed:
 *
 *   1. Cloudflare Turnstile, verified server-side (when configured -- see below)
 *   2. A honeypot field that a human never sees and a bot always fills
 *   3. Zod validation of every field, with hard length caps
 *   4. Supabase RLS, which permits anon INSERT on `messages` and nothing else
 *
 * WHY THIS MOVED FROM THE BROWSER TO THE SERVER
 * The old form called supabase.insert() and the Web3Forms API directly from the
 * client. That works, but the Turnstile token has to be checked somewhere the
 * visitor cannot edit, and "somewhere the visitor cannot edit" is the whole
 * point of a Server Action. The secret key also never reaches the browser.
 */

/* ------------------------------------------------------------------ schema */

// Kept deliberately simple and version-independent rather than using Zod's
// built-in email check, whose name and strictness have moved between Zod 3 and
// Zod 4. This rejects the shapes that are definitely not addresses; the real
// validation of an email address is whether a reply to it arrives.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const ContactSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().trim().min(5).max(200).regex(EMAIL, 'That email address looks wrong'),
  body: z.string().trim().min(1, 'Message is required').max(5000),
  // The honeypot. Must be empty. Not optional: a bot that omits it entirely is
  // as interesting as one that fills it.
  company: z.string().max(200),
  turnstileToken: z.string().max(4096).optional(),
});

export type ContactResult =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'captcha' | 'failed'; message: string };

/* -------------------------------------------------------------- turnstile */

/**
 * Verifies a Turnstile token with Cloudflare.
 *
 * Returns true when verification passed OR when Turnstile is not configured.
 *
 * THAT SECOND CASE IS A JUDGEMENT CALL AND IT IS WRITTEN DOWN ON PURPOSE.
 * Failing closed on a missing secret would mean: the day the owner adds
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY in Vercel but forgets TURNSTILE_SECRET_KEY,
 * every enquiry silently stops arriving, with no error he could diagnose. For a
 * portfolio whose entire commercial value is inbound enquiries, a lost client is
 * a worse outcome than a spam message he can delete in /admin.
 *
 * So a misconfiguration keeps the form working and shouts in the server log
 * instead. If that trade is ever wrong -- if spam becomes the bigger problem --
 * change the `return true` on the misconfigured branch to `return false`, and
 * nothing else needs to move.
 */
async function verifyTurnstile(token: string | undefined, ip: string | null): Promise<boolean> {
  const secret = serverSecret('TURNSTILE_SECRET_KEY');
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  // Turnstile not set up at all. Expected before the owner completes STEP G of
  // the Cloudflare setup; the honeypot and Zod still apply.
  if (!secret && !siteKey) return true;

  if (!secret) {
    console.error(
      '[contact] MISCONFIGURED: NEXT_PUBLIC_TURNSTILE_SITE_KEY is set but ' +
        'TURNSTILE_SECRET_KEY is not. The widget is being shown to visitors but the ' +
        'token cannot be verified, so it is currently protecting nothing. ' +
        'Add TURNSTILE_SECRET_KEY in Vercel (mark it Sensitive) and redeploy.',
    );
    return true;
  }

  // Secret exists but the browser sent no token: either the widget failed to
  // load or someone posted to this action directly. Fail closed.
  if (!token) return false;

  try {
    const form = new FormData();
    form.append('secret', secret);
    form.append('response', token);
    if (ip) form.append('remoteip', ip);

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
      // Cloudflare being slow must not hang the visitor's submit button
      // forever. AbortSignal.timeout is available in the Node 18+ runtime
      // Vercel uses.
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.error('[contact] Turnstile siteverify HTTP', res.status);
      return false;
    }

    const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[] };
    if (!data.success) {
      console.warn('[contact] Turnstile rejected the token:', data['error-codes']);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[contact] Turnstile verification threw:', err);
    // Network failure talking to Cloudflare. Fail closed -- an unverifiable
    // token is not a verified one.
    return false;
  }
}

/* ------------------------------------------------------------------ email */

/**
 * Web3Forms notification, so a message reaches an inbox without the owner
 * having to open /admin.
 *
 * The access key stays NEXT_PUBLIC_ because that is what Web3Forms designed it
 * to be: an alias for the destination address. It can submit to his own inbox
 * and read nothing. It is read here on the server anyway, since the action
 * already runs there.
 */
async function sendEmailNotification(msg: {
  name: string;
  email: string;
  body: string;
}): Promise<boolean> {
  // Resend first: it is the only one of the two that can carry the designed
  // template (lib/contact-email.ts explains why). Returns false when it is not
  // configured, which is a fall-through, not a failure.
  if (await sendViaResend(msg, whenLabel())) return true;

  const key = process.env.NEXT_PUBLIC_WEB3FORMS_KEY;
  if (!key) return false;

  try {
    const res = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key: key,
        subject: `New enquiry from ${msg.name}`,
        from_name: 'Portfolio contact form',
        replyto: msg.email,
        name: msg.name,
        email: msg.email,
        message: msg.body,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch (err) {
    console.error('[contact] email notification failed:', err);
    return false;
  }
}

/* ----------------------------------------------------------------- action */

export async function submitContact(input: unknown): Promise<ContactResult> {
  const parsed = ContactSchema.safeParse(input);

  if (!parsed.success) {
    // The visitor gets a generic sentence. Zod's issue list names internal
    // field paths and constraints, which is information about the system's
    // shape and is of no use to an honest sender.
    return {
      ok: false,
      reason: 'invalid',
      message: 'Please check the fields and try again.',
    };
  }

  const { name, email, body, company, turnstileToken } = parsed.data;

  // Honeypot. Report success so the bot marks the job done and does not retry,
  // but write nothing anywhere.
  if (company.trim().length > 0) return { ok: true };

  // next/headers is imported lazily so this module stays importable from a
  // test or a script that has no request context.
  const { headers } = await import('next/headers');
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;

  if (!(await verifyTurnstile(turnstileToken, ip))) {
    return {
      ok: false,
      reason: 'captcha',
      message: 'The anti-spam check did not pass. Please reload the page and try again.',
    };
  }

  // Two independent deliveries, so one failing never loses the message:
  //   1. the database, which is the durable record and the /admin inbox
  //   2. an email, so it lands in an inbox without him checking /admin
  // allSettled, not all: a rejected email must not discard the database row.
  const [dbResult, mailResult] = await Promise.allSettled([
    supabase.from('messages').insert({ name, email, body }),
    sendEmailNotification({ name, email, body }),
  ]);

  const dbOk =
    dbResult.status === 'fulfilled' && !(dbResult.value as { error?: unknown }).error;
  const mailOk = mailResult.status === 'fulfilled' && mailResult.value === true;

  if (!dbOk) {
    const reason =
      dbResult.status === 'fulfilled'
        ? (dbResult.value as { error?: { message?: string } }).error?.message
        : String(dbResult.reason);
    // Server log only. A Postgres error string can name tables, columns and
    // policies; it never goes to the browser.
    console.error('[contact] database insert failed:', reason);
  }

  // A real failure is only when BOTH routes failed.
  if (!dbOk && !mailOk) {
    return {
      ok: false,
      reason: 'failed',
      message: 'That did not go through.',
    };
  }

  return { ok: true };
}
