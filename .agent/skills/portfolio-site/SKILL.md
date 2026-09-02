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
Measured, upload-ready, no blockers:

| Game | Folder to upload | Files | Size |
| :--- | :--- | ---: | ---: |
| Canopy Chase | `Temple Dash/crazygames` | 94 | 31.7 MB |
| Berm Rush | `MX Offroad Master/main source code` | 138 | 13.8 MB |
| Blackhole Crash | `Blackhole Crash/crazygames` | 7 | 1.9 MB |

Do **not** upload `Temple Dash/main source code` (178 MB) or
`MX Offroad Master/crazygames` (84 MB) — the smaller builds above are the same
games and fit the free-tier egress budget.

Ready-made 16:9 cover images are at `Desktop\portfolio-covers\`.

### Creating a portfolio ZIP

When zipping a game's `FARHAN PORTFOLIO` folder for upload:

1. **Never include the old `.zip` inside the new zip.** Delete or exclude any
   existing `*.zip` before running `Compress-Archive`. This is the #1 cause of
   bloated ZIPs — a 150 MB zip inside a new zip doubles the size for nothing.
2. **Exclude `run_game.bat`** — it starts a local Python server, useless on the
   web.
3. **Only include files the website actually needs:** `index.html`, `game.js`,
   `portfoliosdk.js` (if present), `portfolio.json`, and the `assets/` and
   `assets_gen/` directories. Nothing else.
4. **Include a `portfolio.json`** at the root of the ZIP with metadata fields
   (`title`, `description`, `category`, `ctaLabel`, `tech[]`, `tags[]`). The
   admin panel reads this file on ZIP selection and auto-fills the form.

Example (PowerShell):
```powershell
$src = "...\FARHAN PORTFOLIO"
$tmp = "...\\_zip_temp"
Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $tmp
Copy-Item "$src\index.html","$src\game.js","$src\portfoliosdk.js","$src\portfolio.json" $tmp -ErrorAction SilentlyContinue
Copy-Item "$src\assets" "$tmp\assets" -Recurse
Copy-Item "$src\assets_gen" "$tmp\assets_gen" -Recurse -ErrorAction SilentlyContinue
Compress-Archive -Path "$tmp\*" -DestinationPath "$src\game-name-portfolio.zip" -Force
Remove-Item $tmp -Recurse -Force
```

### Updating an existing game on the site (no re-upload needed)

When the user edits only a few files (e.g. `index.html`, `portfoliosdk.js`) in
a game that is already uploaded, **do not re-upload the entire game**. Instead:

1. Find the existing `storage_path` from the `tools` table (e.g. `g/uuid`).
2. Use `supabase.storage.from('games').upload(path, bytes, { upsert: true })`
   to overwrite only the changed files.
3. For new files, upload them to the same `storage_path` and bump `file_count`
   in the DB.
4. Set `cacheControl: '0'` on updated files so visitors get the new version.

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

Better-suited providers for a game-hosting site, in rough order:

| Provider | Fit |
| :--- | :--- |
| **CrazyGames / Poki SDK** | Best fit. Revenue share on games hosted with them, ad formats designed for gameplay (rewarded video, between-level interstitials). He already ships to CrazyGames. |
| **AdinPlay / GameMonetize** | Built for HTML5 game sites specifically; low traffic bar. |
| **Google AdSense** | Cleanest creatives and best reputation, but approval is a real bar and hosting game content can complicate review. |
| **Adsterra** | Easiest approval and high fill, worst user experience. Last resort. |

Verify current payout terms and Bangladesh payment support before committing —
these change, and this file may be stale.

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
