'use client';

import { useState } from 'react';
import { Send, Check, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/utils/supabase/client';

type State = 'idle' | 'sending' | 'sent' | 'error';

/**
 * Emails the message via Web3Forms.
 *
 * Returns false (rather than throwing) when no key is configured, so the form
 * still works on a fresh deploy and simply relies on the database inbox until
 * NEXT_PUBLIC_WEB3FORMS_KEY is set in Vercel.
 *
 * The access key is deliberately a NEXT_PUBLIC_ value: Web3Forms designs it to
 * be used from the browser. It is an alias for the destination address, not a
 * secret -- it cannot read anything, only submit to the owner's own inbox.
 */
async function sendEmailNotification(msg: {
  name: string;
  email: string;
  body: string;
}): Promise<boolean> {
  const key = process.env.NEXT_PUBLIC_WEB3FORMS_KEY;
  if (!key) return false;

  const res = await fetch('https://api.web3forms.com/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      access_key: key,
      subject: `New enquiry from ${msg.name}`,
      from_name: 'Portfolio contact form',
      // `replyTo` makes hitting Reply in the inbox answer the visitor directly.
      replyto: msg.email,
      name: msg.name,
      email: msg.email,
      message: msg.body,
    }),
  });

  return res.ok;
}

export default function ContactForm({ fallbackEmail }: { fallbackEmail: string }) {
  const [state, setState] = useState<State>('idle');
  const [form, setForm] = useState({ name: '', email: '', body: '' });
  // Honeypot: invisible to people, irresistible to bots. No CAPTCHA, no
  // third-party script, and a filled value is silently discarded.
  const [company, setCompany] = useState('');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState('sending');

    if (company) {
      // Bot. Report success so it does not retry, but write nothing.
      setState('sent');
      return;
    }

    const name = form.name.trim();
    const email = form.email.trim();
    const body = form.body.trim();

    // Two independent deliveries, so one failing never loses the message:
    //  1. the database, which is the durable record and the admin inbox
    //  2. an email, so it actually reaches an inbox without checking /admin
    // Promise.allSettled, not all: a rejected email must not discard the row.
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
      console.error('[contact] database insert failed:', reason);
    }
    if (mailResult.status === 'rejected') {
      console.error('[contact] email notification failed:', mailResult.reason);
    }

    // Only a real failure is when BOTH routes failed. Never show the raw
    // Postgres error to a visitor -- it is meaningless to them.
    if (!dbOk && !mailOk) {
      setState('error');
      return;
    }

    setState('sent');
    setForm({ name: '', email: '', body: '' });
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

      {state === 'error' && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
          <span>
            That didn&apos;t go through. Please try again, or email me directly at{' '}
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
