'use client';

import { useRef, useState } from 'react';
import { Send, Check, AlertCircle, Loader2 } from 'lucide-react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { submitContact } from '@/app/actions/contact';

type State = 'idle' | 'sending' | 'sent' | 'error';

/**
 * The public contact form.
 *
 * WHAT CHANGED AND WHY
 * The submit path used to run entirely in the browser: a supabase.insert() and
 * a fetch to Web3Forms, side by side. It now posts to the `submitContact`
 * Server Action instead. The reason is Cloudflare Turnstile -- a captcha token
 * is worth nothing unless it is verified somewhere the visitor cannot edit, and
 * the secret key that verifies it must never reach the browser.
 *
 * The two-delivery behaviour (database + email, neither able to lose the
 * message if the other fails) moved into the action unchanged.
 *
 * TURNSTILE IS OPTIONAL, AND ABSENCE IS THE NORMAL CASE FOR NOW.
 * The widget renders only when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set. Until the
 * owner finishes the Cloudflare setup the form behaves exactly as before,
 * protected by the honeypot and by server-side validation. Nothing in this file
 * needs editing when the key arrives -- setting it in Vercel is the whole
 * change.
 */

// Read at module scope: NEXT_PUBLIC_ values are inlined at build time, so this
// is a constant in the bundle rather than a lookup on every render.
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export default function ContactForm({ fallbackEmail }: { fallbackEmail: string }) {
  const [state, setState] = useState<State>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [form, setForm] = useState({ name: '', email: '', body: '' });

  // Honeypot: invisible to people, irresistible to bots. It stays in the markup
  // rather than being server-only, because its whole job is to be in the DOM.
  const [company, setCompany] = useState('');

  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileRef = useRef<TurnstileInstance | null>(null);

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState('sending');
    setErrorMessage('');

    try {
      const result = await submitContact({
        name: form.name,
        email: form.email,
        body: form.body,
        company,
        turnstileToken: turnstileToken || undefined,
      });

      if (result.ok) {
        setState('sent');
        setForm({ name: '', email: '', body: '' });
        return;
      }

      // A Turnstile token is single-use. Whatever went wrong, the old token is
      // spent, so the widget is reset before the visitor tries again --
      // otherwise the second attempt fails for a different reason than the
      // first and the message they are reading stops matching reality.
      turnstileRef.current?.reset();
      setTurnstileToken('');
      setErrorMessage(result.message);
      setState('error');
    } catch (err) {
      // A Server Action can reject on a dropped network or a cold-start
      // timeout. The visitor gets one sentence; the detail stays in the console.
      console.error('[contact] submit failed:', err);
      turnstileRef.current?.reset();
      setTurnstileToken('');
      setErrorMessage('That did not go through.');
      setState('error');
    }
  }

  if (state === 'sent') {
    return (
      <div className="rounded-2xl border border-success/30 bg-success/5 p-8 text-center">
        <Check className="w-8 h-8 text-success mx-auto mb-3" aria-hidden />
        <p className="font-semibold text-text">Message sent</p>
        <p className="text-sm text-muted mt-1">I&apos;ll get back to you soon.</p>
        <button
          onClick={() => setState('idle')}
          className="mt-5 text-sm text-lime hover:underline"
        >
          Send another
        </button>
      </div>
    );
  }

  const field =
    'w-full bg-surface border border-hairline rounded-xl px-4 py-3 text-text placeholder:text-subtle ' +
    'outline-none focus:border-lime/60 transition-colors';

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input
        type="text"
        name="company"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] w-px h-px opacity-0"
      />
      <div className="grid sm:grid-cols-2 gap-4">
        <input
          required
          maxLength={120}
          value={form.name}
          onChange={set('name')}
          placeholder="Your name"
          className={field}
          aria-label="Your name"
        />
        <input
          required
          type="email"
          maxLength={200}
          value={form.email}
          onChange={set('email')}
          placeholder="Your email"
          className={field}
          aria-label="Your email"
        />
      </div>
      <textarea
        required
        rows={5}
        maxLength={5000}
        value={form.body}
        onChange={set('body')}
        placeholder="What would you like built?"
        className={`${field} resize-y`}
        aria-label="Your message"
      />

      {TURNSTILE_SITE_KEY && (
        <Turnstile
          ref={turnstileRef}
          siteKey={TURNSTILE_SITE_KEY}
          onSuccess={setTurnstileToken}
          // An expired token is worse than no token: the visitor sees a widget
          // that says it passed while the server rejects it. Clearing the state
          // keeps the failure honest and makes the reset above meaningful.
          onExpire={() => setTurnstileToken('')}
          onError={() => setTurnstileToken('')}
          options={{ theme: 'dark', size: 'flexible' }}
        />
      )}

      {state === 'error' && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
          <span>
            {errorMessage || 'That didn’t go through.'} Please try again, or email me
            directly at{' '}
            <a href={`mailto:${fallbackEmail}`} className="underline underline-offset-2">
              {fallbackEmail}
            </a>
            .
          </span>
        </p>
      )}

      <button
        type="submit"
        disabled={state === 'sending'}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-lime text-ink font-semibold hover:bg-lime-dim transition-colors disabled:opacity-60"
      >
        {state === 'sending' ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Sending…
          </>
        ) : (
          <>
            <Send className="w-4 h-4" aria-hidden /> Send message
          </>
        )}
      </button>
    </form>
  );
}
