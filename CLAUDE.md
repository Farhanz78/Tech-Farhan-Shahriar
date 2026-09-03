# Security & build rules — read this before writing any code

This file is the standing brief for anyone (person or assistant) working on
**farhanshahriar.online** or any other project belonging to Farhan Shahriar.
It is checked into the repository on purpose: it contains no keys, no tokens
and no secrets — only patterns and the reasons behind them.

---

## Who this is for, and the one constraint that shapes everything

The owner **does not write code and cannot debug**. He describes what he wants
and an assistant builds it. That single fact decides most of the trade-offs
below:

- **A silent failure is worse than a loud one.** He will never see a console
  error. If something can fail, it must fail visibly, or it must not be able to
  fail.
- **Anything he might want to change must be changeable from `/admin` or from an
  environment variable in Vercel** — never by editing a file.
- **"It builds, therefore it works" is not verification.** Run it, open it, look
  at it, and say what you actually observed.
- **Never state a number you have not measured.** If you are guessing, say you
  are guessing.

### The absolute rule

**Nothing a visitor can see may mention AI.** Not in copy, not in metadata, not
in alt text, placeholders, empty states, OG tags, commit-generated content, or
anywhere else that reaches a browser. Comments in source files are fine. This
rule has no exceptions and is not up for re-litigation.

---

## 1. Next.js configuration

In `next.config.ts` (this project uses the TypeScript config — do not add a
second `next.config.mjs` alongside it; Next.js will load only one):

```ts
poweredByHeader: false,              // stop advertising the framework
productionBrowserSourceMaps: false,  // do not ship readable source to visitors
```

Constant security headers belong here. **The CSP does not** — it needs a fresh
nonce per request, which a static config cannot produce. It lives in
`proxy.ts`.

| Header | Value | Note |
| :--- | :--- | :--- |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | |
| `X-Content-Type-Options` | `nosniff` | |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | `no-referrer` on game routes |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` | |
| `Cross-Origin-Opener-Policy` | `same-origin` | safe here: no OAuth popups |
| `Cross-Origin-Resource-Policy` | `same-origin` | **not** on `/g/` |
| `X-Frame-Options` | `SAMEORIGIN` — `DENY` only on `/admin` | see below |

### X-Frame-Options must be SAMEORIGIN, not DENY

`DENY` forbids **all** framing, including a page framing itself. `/play/[id]`
works by putting `/g/[id]` in an iframe on the same origin. `DENY` site-wide
turns every game into an empty black box, with the reason visible only in the
browser console — the exact failure the owner cannot diagnose.

`SAMEORIGIN` still blocks every other site on the internet from framing this
one, which is the clickjacking protection the header exists to give.

---

## 2. Proxy (edge middleware): bots, honeypot, CSP

**The file is `proxy.ts`, not `middleware.ts`.** Next.js 16 renamed the
convention; the old name still builds but prints a deprecation warning, and the
export is `proxy(request)` rather than `middleware(request)`. `config` and the
matcher are unchanged. If you are copying a snippet from an older tutorial,
rename both the file and the function.

`proxy.ts` does three things, cheapest rejection first.

**Bot blocking by User-Agent** — HTTrack, wget, curl, libwww-perl,
python-requests, scrapy, aiohttp, and the scanner UAs (sqlmap, nikto, nmap).
Match `curl` as a whole word (`/\bcurl\b/i`); a substring match also hits real
browser extensions. This stops the lazy half of the problem and nothing more:
User-Agent is client-controlled. Cloudflare's Bot Fight Mode and WAF rules are
the layer that handles a determined scraper.

**Honeypot** — `/api/canary` returns 403. It is linked once, invisibly, from
the footer. Do not log IPs to a database from the edge: there is no durable
storage there, an in-memory list is wiped on cold start, and storing visitor
IPs is collecting personal data for no benefit. Blocking is Cloudflare's job.

**CSP with a per-request nonce:**

```ts
const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

const requestHeaders = new Headers(request.headers);
requestHeaders.set('x-nonce', nonce);
requestHeaders.set('Content-Security-Policy', csp);   // <- Next.js reads THIS

const response = NextResponse.next({ request: { headers: requestHeaders } });
response.headers.set('Content-Security-Policy', csp);
```

Setting the policy only on the **response** is the classic mistake: the policy
is enforced, but Next.js's own bootstrap scripts never receive the nonce and the
page never hydrates.

### Five CSP directives that are not what you would first write

These each cost real debugging time. Do not "tighten" them back without
re-reading the reason.

1. **`style-src 'self' 'unsafe-inline'` — no nonce.**
   In CSP Level 3 `'unsafe-inline'` is **ignored** when a nonce is present in
   the same directive. And a nonce cannot authorise a style *attribute* — nonces
   only apply to `<style>` elements. Server-rendered `style="..."` attributes
   (and React writes plenty) all break. Scripts stay nonce-locked; styles are
   not the XSS vector scripts are.

2. **`frame-src 'self' …`** — without `'self'`, `/play/[id]` cannot frame
   `/g/[id]` and every game fails to load.

3. **`frame-ancestors 'self'`, not `'none'`** — same reason, from the other
   direction.

4. **`worker-src 'self' blob:`** — `fflate`'s `unzip()` runs in a Web Worker
   created from a `blob:` URL. Without it, the admin panel's `.zip` upload dies
   at "reading archive".

5. **`'unsafe-eval'` in development only** — Next.js's hot reloader evaluates
   modules with `eval`. Without it the dev server shows a blank page.

### Game routes are excluded from the CSP entirely

`/g/[id]` serves **arbitrary uploaded bundles** — Unity and Emscripten output,
engine templates, ad SDKs from networks that did not exist when the policy was
written. A CSP tight enough to be worth having breaks them silently and
intermittently. They are already isolated by being in an iframe, and can be
moved to their own origin with `NEXT_PUBLIC_GAME_ORIGIN`.

---

## 3. Supabase Row Level Security

**Every table gets RLS enabled.** The anon key is compiled into the JavaScript
bundle of every page; without RLS it is a public read of the whole table.

```sql
alter table public.<name> enable row level security;
```

**Always write policies as `(select auth.uid())`, never bare `auth.uid()`.**
The bare form re-evaluates once per row; wrapped in a scalar subquery it is
evaluated once per statement and can use an index. Supabase's own linter flags
the unwrapped form.

```sql
create policy "rows_own" on public.thing
  for select to authenticated
  using ( (select auth.uid()) = user_id );
```

### FORCE ROW LEVEL SECURITY is not a free upgrade

`ENABLE` applies RLS to ordinary roles. `FORCE` additionally applies it to the
table **owner** — which in Supabase is `postgres`, which is what every
`SECURITY DEFINER` function runs as. So `FORCE` breaks any definer function that
relies on the owner's RLS bypass.

In this project that is two functions, and the failures are instructive:

| Table | Function | What FORCE does |
| :--- | :--- | :--- |
| `profiles` | `is_admin()` | policy calls `is_admin()` → reads `profiles` → evaluates policy → **42P17 infinite recursion.** Admin panel stops loading. |
| `tools` | `increment_play_count()` | UPDATE matches zero rows and **succeeds having done nothing.** Play counts silently stop, forever, with no error anywhere. |

So: `FORCE` on `messages` (nothing runs as owner against it), **not** on
`profiles` or `tools`. Note also that `service_role` has `BYPASSRLS`, which
overrides `FORCE` anyway, and anyone holding the `postgres` password can simply
`ALTER TABLE … NO FORCE`. The benefit is small; the breakage is silent.

See `supabase_rls_hardening.sql`, which also contains a verification query that
prints a plain-English verdict per table.

---

## 4. Server Actions

Default pattern for anything touching the owner's data:

```ts
'use server';

export async function action(input: unknown) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');      // 1. authenticate

  const parsed = Schema.safeParse(input);          // 2. validate with Zod
  if (!parsed.success) throw new Error('Invalid input');

  // 3. never return a raw database error to the client
}
```

Three rules, in order: **authenticate, validate, never leak the error.** A
Postgres error string names tables, columns and policies — log it on the
server, send the visitor one sentence.

**Use `getUser()`, not `getSession()`.** `getSession()` reads a cookie the
client can write; `getUser()` verifies the token with the auth server.

### The public exception, stated rather than hidden

`app/actions/contact.ts` is **deliberately unauthenticated**. It is the public
contact form; requiring a login would mean a prospective client has to create an
account before saying hello, which defeats the site's only commercial purpose.
Instead it has four independent gates that each fail closed: Turnstile verified
server-side, a honeypot field, Zod validation with hard length caps, and RLS
that permits anon `INSERT` on `messages` and nothing else.

When you break a rule in this file, break it like that: in one named place,
with the reason written next to it.

---

## 5. Environment variables

**`NEXT_PUBLIC_` means "published to every visitor".** Anything with that prefix
is inlined into the browser bundle.

- `SUPABASE_SERVICE_ROLE_KEY` — **never** `NEXT_PUBLIC_`. That key is
  unrestricted read/write on the entire database and bypasses RLS.
- `TURNSTILE_SECRET_KEY` — server only, marked Sensitive in Vercel.
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_WEB3FORMS_KEY` — public by
  design. The Web3Forms key is an alias for the destination inbox; it can submit
  and read nothing.

`lib/env.ts` checks this **mechanically at build time**, because the mistake is
a one-character slip in a dashboard field with no undo. It base64-decodes every
long `NEXT_PUBLIC_` value and throws if the JWT payload says
`role: "service_role"` — name-based checks miss it, since the name is exactly
what the mistake gets wrong.

If it ever fires: rename the variable **and rotate the key in Supabase.** The
old one must be assumed compromised.

---

## 6. Forms: honeypot + Turnstile

- Honeypot field, off-screen, `tabIndex={-1}`, `aria-hidden`. A filled value is
  discarded and the bot is told "sent" so it does not retry.
- **Cloudflare Turnstile, verified server-side.** A token checked in the browser
  is worth nothing.
- **Degrade when unconfigured.** The widget renders only if
  `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set. If the site key is set but the secret
  is missing, the form keeps working and logs a loud server error — a lost
  client is worse than a spam message he can delete in `/admin`. That trade is
  written down at the branch that makes it; if spam ever becomes the bigger
  problem, one `return true` becomes `return false`.
- A Turnstile token is **single-use**. Reset the widget after any failed submit,
  or the retry fails for a different reason than the first attempt.

---

## 7. Animation (GSAP)

- **Free plugins only:** ScrollTrigger, Flip, Observer, Draggable,
  MotionPathPlugin, CustomEase. Never SplitText, MorphSVG or ScrollSmoother —
  they are Club GSAP. They are not in `package.json`, so an import fails the
  build rather than failing at runtime, which is the safer failure.
- Register once, in `components/GSAPInit.tsx`, mounted from the root layout.
- **All GSAP lives in `'use client'` components.** Never in a Server Component.
- **Always `useGSAP()` from `@gsap/react`,** never a bare `useEffect`. It
  reverts every tween and ScrollTrigger on unmount; without it each visit to a
  page leaks a ScrollTrigger per section that keeps listening to scroll and
  keeps a detached DOM node alive.
- **Reduced motion:** check `prefers-reduced-motion` and build nothing when it
  is set — but never leave an element in its "from" state as a result.
- **A failed animation must never hide content.** Use `fromTo`, so the hidden
  state is applied by JavaScript at animation time rather than by a CSS class in
  the server-rendered HTML. If the bundle fails to load, the page renders
  visible. Same reason `globals.css` uses `forwards` and never `both`.
- **Do not animate a component that animates itself.** `PhotoCarousel.tsx` owns
  its own transforms; wrap it from the outside and animate the wrapper. Two
  systems writing the same element's transform is how two working animations
  become one broken one.

### The WebGL hero (`components/Hero3D.tsx`)

Custom GLSL: a noise-driven particle volume, a displaced core and a lattice
shell, all sampling one shared simplex-noise function so they move as one field.
No `EffectComposer` — the glow is additive blending plus a fresnel term, which
costs nothing and has no second render target to fail on.

Four things this cost, all found by looking at it rather than by reading it:

1. **Additive blending stacks.** A per-point alpha that looks right alone is
   glare where twenty points overlap. The first pass rendered a blown-out blob.
2. **Two shells sharing one fragment shader need different colour inputs.** The
   lattice has a large displacement amplitude, so most of its surface cleared
   the lime threshold and the whole scene turned yellow-green. It now gets a
   cold cyan as its highlight; only the core is allowed lime.
3. **A fresnel with a constant added term fills the silhouette.** `fres*1.7+0.05`
   lit the whole face; the `+0.05` had to go and the exponent had to tighten.
4. **Never protect text legibility with shader tuning.** A WebGL scene's
   brightness at a given pixel depends on how many particles happen to overlap
   there, so "it looks fine now" lasts until the next tweak. `HeroCanvas` puts a
   gradient **scrim on top of the canvas**; that is the guarantee, and the
   shader is then free to be as bright as it looks good.

Reduced motion renders **one still frame** rather than removing the scene. The
visitor asked for less motion, not less design.

Every failure path leaves the CSS gradient showing: the build is wrapped in
try/catch, `webglcontextlost` hides the canvas, and `shouldRender3D()` refuses
Data Saver, ≤2 cores and ≤2 GB devices before three.js is even imported.

---

## 8. Verifying, before saying it is done

1. `npx next build` — zero errors.
2. `npm run dev -- --port 3007`, then actually open it.
3. Scroll the whole page. Watch each animation run.
4. Check the browser console for **CSP violations** specifically — a blocked
   script is silent in the UI and loud in the console.
5. Resize to **375px**. No horizontal overflow.
6. Visit `/work`, `/admin` and a `/play/[id]` game. All still work.
7. Confirm `x-powered-by` is gone and no `.map` files load in a production build.

Report what you observed, including anything you skipped or could not test.

---

## 9. Cloudflare (the owner does this himself)

DNS proxied (orange cloud), **SSL/TLS mode Full (strict)** — Flexible causes a
redirect loop with Vercel — Always Use HTTPS on, Bot Fight Mode on, and five WAF
custom rules blocking: sensitive files (`.env`, `.git`, `.aws`), WordPress
probes, database/backup probes, path traversal, and a Managed Challenge for
`cf.threat_score > 25` and scanner user-agents.

Turnstile widget domains must include `localhost`, or the form cannot be tested
locally.
