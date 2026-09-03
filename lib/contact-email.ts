/**
 * =============================================================================
 *  THE ENQUIRY NOTIFICATION EMAIL
 * =============================================================================
 *
 * WHY THERE ARE TWO SENDERS
 * Web3Forms -- what this site used before -- has NO custom template on the free
 * plan. Its API accepts access_key, subject, from_name, replyto and the field
 * values, and nothing else; the PRO plan adds only an "intro text" box in their
 * dashboard, not control of the HTML. So a designed email is simply not
 * reachable through it.
 *
 * Resend is. Free tier, full HTML, and its unverified-domain restriction --
 * you may only send to the address you signed up with -- is exactly this use
 * case, because the only recipient is the owner's own inbox.
 *
 * So: Resend when RESEND_API_KEY exists, Web3Forms otherwise, and the database
 * row underneath both. Nothing here can lose a message on its own.
 *
 * EMAIL HTML IS NOT WEB HTML
 * Gmail strips <style> blocks, ignores flexbox and grid, and drops most modern
 * CSS. Everything below is tables and inline styles on purpose. Do not
 * "modernise" it -- it will look correct in a browser and broken in the inbox,
 * which is the one place nobody checks.
 */

export interface Enquiry {
  name: string;
  email: string;
  body: string;
}

const INK = '#0B0C0E';
const SURFACE = '#141619';
const HAIRLINE = '#24282E';
const TEXT = '#F2F4F7';
const MUTED = '#A8AEB8';
const LIME = '#C4F82A';

/** Blocks HTML injection from the visitor's own name, email or message. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Preserves the visitor's paragraph breaks without allowing any other markup. */
function paragraphs(body: string): string {
  return esc(body)
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;color:${TEXT};font-size:15px;line-height:1.65;">${p.replace(
          /\n/g,
          '<br>',
        )}</p>`,
    )
    .join('');
}

export function enquirySubject(name: string): string {
  return `New enquiry from ${name}`;
}

/**
 * Plain-text alternative. Not optional: a message with no text part scores
 * higher as spam, and some clients show it instead of the HTML.
 */
export function enquiryText(e: Enquiry, whenLabel: string, verified = true): string {
  return [
    'NEW ENQUIRY — farhanshahriar.online',
    ...(verified
      ? []
      : ['', '!! SPAM CHECK DID NOT RUN — this message was delivered unverified.']),
    '',
    `Name:  ${e.name}`,
    `Email: ${e.email}`,
    `Time:  ${whenLabel}`,
    '',
    'Message',
    '-------',
    e.body,
    '',
    `Reply directly to this email to answer ${e.name}.`,
  ].join('\n');
}

export function enquiryHtml(e: Enquiry, whenLabel: string, verified = true): string {
  const name = esc(e.name);
  const email = esc(e.email);

  // Shown only when the spam check did not run -- because the widget was
  // blocked, Cloudflare was unreachable, or Turnstile is not configured. The
  // message is delivered either way (a lost client is worse than a spam mail),
  // so this strip is how he tells the two apart without reading a log.
  const unverifiedStrip = verified
    ? ''
    : `<tr>
          <td style="padding:0 30px 4px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="background:#2A2205;border:1px solid #5C4A0A;border-radius:10px;">
              <tr>
                <td style="padding:11px 14px;font-family:Arial,Helvetica,sans-serif;">
                  <p style="margin:0;color:#FFB020;font-size:12px;line-height:1.5;">
                    <strong>Spam check did not run.</strong> The Turnstile widget was blocked or
                    unreachable for this visitor, so this message was delivered unverified.
                    Treat it with a little more caution than usual.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
  const replyHref = `mailto:${encodeURIComponent(e.email)}?subject=${encodeURIComponent(
    `Re: your enquiry — Farhan Shahriar`,
  )}`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>${esc(enquirySubject(e.name))}</title>
</head>
<body style="margin:0;padding:0;background:${INK};">

<!-- Preheader: the grey line Gmail shows next to the subject in the list.
     Hidden in the body itself by zero size and clipping. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">
  ${name} &lt;${email}&gt; — ${esc(e.body.slice(0, 90))}
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background:${INK};padding:28px 12px;">
  <tr>
    <td align="center">

      <!--[if mso]>
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td>
      <![endif]-->

      <!-- FLUID, capped at 600.
           The first version set width="600" plus style="width:600px", and on a
           375px phone the card stayed 600 wide and the message was cut off on
           the right: measured scrollWidth 624 against the viewport. A table with
           a fixed width attribute does not shrink for max-width.
           So: width 100% and max-width 600px for every modern client, and the
           MSO conditional ghost table above pins 600px for Outlook, which is
           the only engine that needs the fixed number. -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="width:100%;max-width:600px;background:${SURFACE};border:1px solid ${HAIRLINE};border-radius:14px;overflow:hidden;">

        <!-- Lime rule. A background colour on a table cell is the only bar that
             renders everywhere; a border-top is dropped by Outlook. -->
        <tr><td style="background:${LIME};height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>

        <tr>
          <td style="padding:30px 30px 22px;">
            <p style="margin:0 0 6px;color:${LIME};font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">
              New enquiry
            </p>
            <p style="margin:0;color:${TEXT};font-size:25px;font-weight:700;line-height:1.25;font-family:Arial,Helvetica,sans-serif;">
              ${name}
            </p>
          </td>
        </tr>

        ${unverifiedStrip}

        <!-- Sender details -->
        <tr>
          <td style="padding:${verified ? '0' : '10px'} 30px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="background:${INK};border:1px solid ${HAIRLINE};border-radius:10px;">
              <tr>
                <td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;">
                  <p style="margin:0 0 3px;color:${MUTED};font-size:11px;letter-spacing:0.6px;text-transform:uppercase;">Email</p>
                  <p style="margin:0 0 12px;font-size:15px;">
                    <a href="mailto:${email}" style="color:${LIME};text-decoration:none;">${email}</a>
                  </p>
                  <p style="margin:0 0 3px;color:${MUTED};font-size:11px;letter-spacing:0.6px;text-transform:uppercase;">Received</p>
                  <p style="margin:0;color:${TEXT};font-size:14px;">${esc(whenLabel)}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Message -->
        <tr>
          <td style="padding:22px 30px 4px;font-family:Arial,Helvetica,sans-serif;">
            <p style="margin:0 0 10px;color:${MUTED};font-size:11px;letter-spacing:0.6px;text-transform:uppercase;">Message</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="border-left:3px solid ${LIME};padding:2px 0 2px 14px;font-family:Arial,Helvetica,sans-serif;">
                  ${paragraphs(e.body)}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Reply button. A table with a background colour, not a styled <a>:
             Outlook ignores padding on an anchor and the button collapses. -->
        <tr>
          <td style="padding:22px 30px 30px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="background:${LIME};border-radius:10px;">
                  <a href="${replyHref}"
                     style="display:inline-block;padding:13px 26px;color:${INK};font-size:15px;font-weight:700;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">
                    Reply to ${name}
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:14px 0 0;color:${MUTED};font-size:12px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">
              Replying to this email answers ${name} directly. A copy is saved in
              <a href="https://farhanshahriar.online/admin" style="color:${LIME};text-decoration:none;">your admin inbox</a>.
            </p>
          </td>
        </tr>

        <tr><td style="border-top:1px solid ${HAIRLINE};"></td></tr>
        <tr>
          <td style="padding:16px 30px;text-align:center;font-family:Arial,Helvetica,sans-serif;">
            <p style="margin:0;color:#6E747E;font-size:12px;">
              Sent from the contact form at
              <a href="https://farhanshahriar.online" style="color:${MUTED};text-decoration:none;">farhanshahriar.online</a>
            </p>
          </td>
        </tr>

      </table>

      <!--[if mso]>
      </td></tr></table>
      <![endif]-->

    </td>
  </tr>
</table>
</body>
</html>`;
}

/**
 * Sends through Resend. Returns false when it is not configured, so the caller
 * can fall through to Web3Forms rather than treating it as a failure.
 *
 * RESEND_FROM defaults to Resend's shared onboarding sender, which works with no
 * DNS setup at all but may ONLY deliver to the address the Resend account was
 * created with. That is exactly the requirement here -- the only recipient is
 * the owner. Verifying farhanshahriar.online in Resend and setting RESEND_FROM
 * to something like "Portfolio <hello@farhanshahriar.online>" removes that
 * limit and improves deliverability, but nothing breaks without it.
 */
export async function sendViaResend(
  e: Enquiry,
  whenLabel: string,
  verified = true,
): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  if (!key || !to) return false;

  const from = process.env.RESEND_FROM || 'Portfolio <onboarding@resend.dev>';

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        // The subject carries the flag too, so it is visible in the inbox list
        // without opening the message.
        subject: verified ? enquirySubject(e.name) : `[unverified] ${enquirySubject(e.name)}`,
        html: enquiryHtml(e, whenLabel, verified),
        text: enquiryText(e, whenLabel, verified),
        // Hitting Reply in Gmail answers the visitor, not the sending domain.
        reply_to: e.email,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.error('[contact] Resend rejected the message:', res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('[contact] Resend threw:', err);
    return false;
  }
}

/** Human-readable timestamp in the owner's own timezone. */
export function whenLabel(d = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Asia/Dhaka',
  }).format(d);
}
