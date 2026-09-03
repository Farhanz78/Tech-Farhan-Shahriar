---
name: portfolio-site
description: Work on Farhan Shahriar's portfolio site (Next.js + Supabase, at Desktop/spell website) — adding games/apps/tools to it, changing the design or copy, wiring ads, or fixing the admin panel. Use whenever the request touches this portfolio, the /work page, the project popup, the game player, the admin panel, or adding an already-built game or app to the site.
---

# Portfolio Site

Next.js 16 + Supabase portfolio at `C:\Users\nisa8\OneDrive\Desktop\spell website`,
live at farhanshahriar.online. It presents Farhan Shahriar as a **full-stack
developer** and also hosts and runs his own browser games.

Read `Project_Details_For_Claude.txt` in the project root for accounts, schema
and architecture. Read `SETUP.md` for the owner-facing setup steps.

## The three rules

1. **No AI mention anywhere a visitor can see.** Not in copy, metadata, alt
   text, placeholders, empty states or OG tags. This is absolute and the owner
   has repeated it. Internal source comments are fine.
2. **The owner cannot code and cannot debug.** Prefer robust over clever.
   Anything that can silently break on a visitor's device is a bad trade.
   Everything he might want to change must be editable from `/admin`, never by
   editing a file.
3. **Verify by running it.** This project has produced "it builds, therefore it
   works" mistakes. Run `npx next build`, start the dev server, and look at the
   page before claiming anything works.

## Site structure

| Route | What it is |
| :--- | :--- |
| `/` | About the person. Hero (3D), services, about, process, contact. **No project grid** — the landing page sells him, not the work. |
| `/work` | The portfolio. Category filter + cards. Clicking a card opens a popup, it does not navigate. |
| `/play/[id]` | Full-screen player, iframes `/g/[id]`. |
| `/g/[id]` | Route handler. Serves a project's HTML as real `text/html`. |
| `/admin` | Upload / Manage / Messages / Profile. Deliberately plain — no 3D, just controls. |

## Adding an already-built game or app

This is the most common task. The admin panel has four modes; pick by what you
have. Nothing here requires touching code.

| You have | Mode | Notes |
| :--- | :--- | :--- |
| A folder with `index.html` + assets | **Upload folder** | Best for his own builds. Browser asks to confirm multiple files. |
| A `.zip` of that folder | **Upload .zip** | Wrapper folder is stripped automatically. |
| One self-contained `.html` file | **Paste HTML** | For small tools. |
| Work hosted elsewhere | **Link only** | Play Store apps, client sites, games on another portal. Nothing is uploaded. |

His existing builds live in `C:\Users\nisa8\OneDrive\Desktop\Claude Games\`.

> **Superseded 2026-09-03.** This table used to say upload `Temple Dash/
> crazygames`, `MX Offroad Master/main source code` and `Blackhole Crash/
> crazygames`. **Do not.** Those are the CrazyGames builds — they carry the
> CrazyGames SDK, which is dead on this domain, and no ad network at all.

Each game now has a `portfolio/` folder — the web build made *for this site*,
with GameMonetize wired in. `python "Claude Games/build_portfolio_zips.py"`
stages it into `FARHAN PORTFOLIO/` and writes the upload zip one level up.
**Upload the zip, never the folder:**

| Game | Zip to upload at `/admin` | Size |
| :--- | :--- | ---: |
| Canopy Chase | `Temple Dash/canopy-chase-portfolio.zip` | 12.3 MB |
| Berm Rush | `MX Offroad Master/berm-rush-portfolio.zip` | 7.2 MB |
| Blackhole Crash | `Blackhole Crash/blackhole-crash-portfolio.zip` | 0.2 MB |

Two stale archives sit beside them from an earlier attempt —
`canopy-chase-gamemonetize.zip` (**151 MB**, 177 MB of unoptimised assets
inside) and `berm-rush-gamemonetize.zip`. Neither is a valid build. Uploading
the first would put 151 MB into Supabase Storage for a game that fits in 12.3.

Ready-made 16:9 cover images are at `Desktop\portfolio-covers\`.

### Two things that block an upload

- **`.gz` or `.br` files in the build.** Supabase Storage cannot send
  `Content-Encoding`, so the browser never decodes them. Re-export with
  compression disabled. The admin panel detects this and refuses with that
  message.
- **Any single file over 50 MB.** Total bundle size can be much larger.

### After uploading, always

Open **Manage → pencil icon** and fill in: description, cover image, category,
**button text**, and "Built with". A card with no description and no cover is
the single biggest thing that makes the portfolio look unfinished.

## The project popup

Cards do not navigate. `components/WorkGrid.tsx` opens
`components/ProjectModal.tsx`, which shows the title, category, description,
role note, tech chips, and then a button.

The button's label comes from `tools.cta_label`, editable per project in the
admin panel. When empty it falls back to "Play now" for games and
"Open project" for everything else. `projectTarget()` in `ProjectModal.tsx`
decides where it goes: `external_url` for `kind='link'`, otherwise `/play/[id]`.

## Categories

`tools.category` is one of `game | web | mobile | tool`, enforced by a CHECK
constraint. `CATEGORY_LABEL` in `types/index.ts` maps them to the labels shown
on the site. To add a category you must change **both** the constraint in
`supabase_migration.sql` and `CATEGORY_LABEL`, or the filter will show a blank
chip.

## The 3D hero

`components/Hero3D.tsx` — plain three.js, not react-three-fiber. One
self-contained scene does not justify the R3F + drei reconciler on top of three.

`components/HeroCanvas.tsx` gates and lazy-loads it. `shouldRender3D()` returns
false for: reduced-motion, Data Saver, viewport under 640px, 2 or fewer CPU
cores, or no WebGL. When it returns false the module is **never downloaded** and
the gradient fallback is what shows. The render loop also stops when the hero
scrolls out of view or the tab is hidden.

Geometry is procedural — there are no downloaded model assets to manage.

If asked to make the 3D "more impressive", the ceiling is mobile battery and
first paint, not imagination. Keep draw calls low, keep the DPR capped at 2, and
never let the loop run off-screen.

### Animation rule learned the hard way

CSS entrance animations here use `fill-mode: forwards`, never `both`. With
`both` the element also takes the keyframe's FROM state before the animation
starts, so if the animation never runs the content sits at `opacity: 0`
permanently. This actually happened to the project popup. **Never gate the
visibility of real content on an animation running.**

## The contact form

`components/ContactForm.tsx` delivers each submission **twice**, via
`Promise.allSettled` so one failing never discards the other:

1. **Supabase `messages` table** — the durable record, read in `/admin` →
   Messages. Always on.
2. **Email via Web3Forms** — only when `NEXT_PUBLIC_WEB3FORMS_KEY` is set in
   Vercel. Free tier is 250/month; the key is public by design (an alias for the
   destination address, it cannot read anything).

The form reports success if **either** route succeeded, and only shows an error
when both failed. Never surface the raw Postgres error to a visitor.

A past misunderstanding worth avoiding: the owner assumed "contact form" meant
email and did not know the messages were sitting in `/admin`. If you change how
this works, say plainly where messages end up.

## Ads

**Recommendation: keep ads off the portfolio pages entirely.**

The site's job is to convince a client to hire him. A visitor who lands on a
"hire me" page and gets a popunder does not hire the person who put it there.
One freelance project is worth more than a year of ad revenue at this traffic
level, so ads on `/`, `/work` and `/admin` are a straight loss.

**Adsterra specifically**: its money formats are popunder, "social bar" and
direct-link — the intrusive end of the market, with weaker creative vetting than
the mainstream networks. That is survivable on a throwaway content site. On a
portfolio it actively works against the goal.

If ads are wanted anyway, the only defensible placement is the **hosted game
pages** (`/play/[id]`), where a visitor is playing rather than evaluating him.

### Which network — researched 2026-09-03, not guessed

**Correction to an earlier version of this file:** it listed "CrazyGames / Poki
SDK" as the best fit for this site. That is wrong and the mistake is worth
naming. Their SDKs only serve ads **on their own domains** — CrazyGames'
publishing rules forbid external ad networks in a game hosted with them, and
their SDK returns nothing when the game is served from anywhere else. They are
a distribution channel, not a monetisation option for `farhanshahriar.online`.

| Provider | Approval bar | Rewarded video | Verdict for this site |
| :--- | :--- | :--- | :--- |
| **GameMonetize** | None — self-serve, instant | **No real API** (see below) | What is wired in today. Fine as a starting layer. |
| **Google H5 Games Ads** | High: an approved AdSense account **plus** a separate allowlisting review | Yes — a real `adViewed` callback | The right destination. Not available yet. |
| **AdinPlay / Venatus** | Contact-based; built around established portals | Yes | Revisit once traffic is consistent. Solo devs are hard to onboard. |
| **Playwire, CPMStar** | Stated traffic minimums, portal-scale | Yes | Out of reach at this traffic. |
| **Adsterra / Monetag** | Trivial | No | Popunders and social bars. Last resort; actively harms a hire-me site. |

**The GameMonetize limitation, measured not assumed.** Their live `sdk.js` was
decoded: `showBanner()` takes no arguments, only `preroll` and `midroll` exist
internally, and there is **no rewarded placement and no "watch complete"
event**. Reward gating there is a proof-of-play heuristic (ad filled → ad ended
→ ≥ 4 s elapsed), documented in `Claude Games/PLATFORM-RULES.md`. It cannot
distinguish a skip at second 6 of a 30-second ad from a full watch.

**Google's Ad Placement API can.** `adBreak({type:'reward', beforeReward,
adViewed, adDismissed, ...})` — `adViewed` fires only on a completed view,
`adDismissed` on a skip. That is a genuine reason to migrate, not just a CPM
argument. Reported 2026 web rewarded eCPM is around $3.62 global / $6.98 US,
well under mobile's $16–20; treat any number in this table as needing
re-measurement before it drives a decision.

**What blocks H5 Games Ads today**, in order:

1. **An approved AdSense account.** This is the real gate — H5 access is a
   second form on top of it. Google requires content that is "high-quality,
   original, and attract[s] an audience", and the applicant to be 18+.
2. **Site age.** Google names China and India as places where they require six
   months of site ownership. Bangladesh is *not* named by Google — that claim
   comes only from SEO blogs — but applying with a six-month-old, content-rich
   site is the safe play regardless.
3. **Thin content.** A three-game portfolio is exactly the shape reviewers
   reject: near-empty pages, no original written content, duplicate cards. Real
   descriptions, covers and a written page per game are prerequisite work, not
   polish.
4. **H5 formats are not on by default** even after AdSense approval — a
   separate allowlisting review at `adsense.google.com/start/h5-games-ads/`.

**The sequence to recommend:** keep GameMonetize running on `/play/[id]` now,
because it needs no approval and pays something. In parallel fill in the site's
written content and let the domain age. Apply for AdSense once the site has
real pages and some traffic; apply for H5 Games Ads immediately after it is
approved. Because both go through the same `AdSlot` layer (below) and the same
single ad door in each game, switching is a config change, not a rewrite.

Verify payout terms and Bangladesh payment support before committing to any of
these — they change, and this file goes stale.

### If ads do get added, build it as one switchable layer

Do not scatter network snippets across pages. Create `components/AdSlot.tsx`
that takes a placement name, reads the network and IDs from
`NEXT_PUBLIC_AD_*` environment variables, renders nothing when they are unset,
and loads the third-party script with `next/script` (`strategy="lazyOnload"` so
it never competes with first paint). Then switching networks — or turning ads
off entirely — is an environment-variable change in Vercel, not a code change,
and it is reusable in his next project.

Two non-negotiables: reserve the slot's height in CSS so an injected banner
cannot shift the layout, and never render `AdSlot` on `/admin` or on the
portfolio pages.

**`AdSlot` is for page banners only.** Ads *inside* a game are a different
system entirely: they live in the game's own bundle, behind that game's single
ad door (`CG` in all three of his games), and the site never sees them. Do not
try to drive an in-game rewarded ad from React — `/g/[id]` is a separate
document served as raw HTML, and the game is inside an iframe.

**The reward rule, which is absolute.** A player gets coins, a revive or a
boost **only** when a video was actually watched. Every failure path — no fill,
adblock, SDK missing, network dead, tab hidden, user skipped — must grant
nothing and say why. This has already been got wrong four separate times
across the three games; the worst case made *every* reward in Berm Rush free.
"Grant it anyway so the player isn't stuck" is how that happens, and it is
never the right call. If a game shows a reward button, that button must be
capable of failing visibly.

## Working on this project

```bash
cd "C:\Users\nisa8\OneDrive\Desktop\spell website"
npm run dev          # http://localhost:3000
npx tsc --noEmit     # types
npx next build       # must pass before saying it is done
```

**The OneDrive trap.** This folder is inside OneDrive and Turbopack's file
watcher regularly misses changes — edits to `globals.css` and to server
components get silently ignored while stale compiled output keeps being served.
It looks exactly like "my CSS variables aren't working". Fix: stop the dev
server, delete `.next`, start again. Suspect this before debugging the code.

**Schema changes.** `supabase_migration.sql` is idempotent and is the schema of
record. To add a column, add it there and have the owner re-run the whole file
in the Supabase SQL editor — do not write a second migration file.

**Writes that silently do nothing.** Supabase returns `204 No Content` with
`error === null` when RLS filters a row out of an UPDATE or DELETE. Always add
`.select('id')` and check the returned array length, or a blocked write looks
like a successful one. Every mutation in the admin panel already does this.
