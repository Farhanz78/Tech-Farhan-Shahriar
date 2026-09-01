# Setup

## Get contact-form messages by email

Every message someone sends is **already saved** — open `/admin` → **Messages**.
Nothing is ever lost. But to also get them in your Gmail inbox:

1. Go to **https://web3forms.com**.
2. Type `ftamim440@gmail.com` in the box and press **Create Access Key**.
3. They email you an access key. Copy it.
4. Go to **Vercel → your project → Settings → Environment Variables**.
5. Add:
   - Name: `NEXT_PUBLIC_WEB3FORMS_KEY`
   - Value: the key they emailed you
6. Save, then **Deployments → ⋯ → Redeploy**.

Free plan is 250 messages a month, which is far more than a portfolio receives.
The key is safe to be public — it only lets someone send a message *to you*, it
cannot read anything.

Until you do this, the form still works and still stores every message; you just
have to check `/admin` → Messages to see them.

## ⚠️ Run the SQL once more

New fields were added after you last ran it: the **button text** for each
project, the extra categories (Web Apps, Mobile Apps), "Built with", and
link-only projects.

1. **https://supabase.com/dashboard** → your project (**StudyBudy**).
2. **SQL Editor → + New query**.
3. Open `supabase_migration.sql`, select all (**Ctrl+A**), copy, paste, **Run**.

It is safe to run again — it only adds what is missing and will not touch your
existing projects.

## ⚠️ Delete the test admin account

Your database has a second administrator: the `test@example.com` login with the
password `123456`. That is a guessable account with full control of your site.

1. **Authentication → Users** → find `test@example.com`.
2. Three dots at the end of the row → **Delete user**.

---

# First-time setup — do these once, in order

Everything in the code is finished. These are the steps only you can do,
because they need your Supabase and Vercel logins.

Do them in this order. Step 1 takes two minutes and is the important one.

---

## Step 1 — Run the database update

Until you do this, the new upload features will not work, and the delete button
in your admin panel will keep silently doing nothing.

1. Go to **https://supabase.com/dashboard** and open your project.
2. In the left sidebar click **SQL Editor**.
3. Click **+ New query** (top right).
4. Open the file `supabase_migration.sql` from this project folder in Notepad.
5. Select everything (**Ctrl+A**), copy (**Ctrl+C**).
6. Paste it into the Supabase SQL box (**Ctrl+V**).
7. Click the green **Run** button (bottom right), or press **Ctrl+Enter**.
8. You should see **Success. No rows returned.** That is what success looks like.

Safe to run more than once. It will not delete or overwrite your existing games.

---

## Step 2 — Turn off public sign-ups

Right now **any stranger on the internet can create an account on your
Supabase project.** Your site only ever needs one account: yours.

1. In the Supabase dashboard, click **Authentication** in the left sidebar.
2. Click **Sign In / Providers**.
3. Find **Email** in the list and click it.
4. Turn **OFF** the switch labelled **Allow new users to sign up**.
5. Click **Save**.

---

## Step 3 — Check who your administrators are

**Your database currently has two accounts marked as administrator.** One is
yours. I could not tell you what the second one is, so you need to look.

1. In the Supabase dashboard, click **Table Editor** in the left sidebar.
2. Select the **profiles** table.
3. Look at the **role** column. You will see two rows saying `admin`.
   One of them has your name, "Farhan Shahriar". The other has no name.
4. Decide whether the second one is an old test account you made yourself.

**If you do not recognise it**, remove it:

1. Click **Authentication** in the left sidebar, then **Users**.
2. Find the user whose ID matches the unnamed profile row.
3. Click the three dots at the end of the row, then **Delete user**.

Then change your own password:

1. **Authentication → Users**, find your own account.
2. Three dots → **Send password recovery**, and follow the email.

> Why this matters: before today's fix, the site had a hole where anyone who
> signed up could make themselves an administrator with a single request. An
> unexplained second admin account is exactly what that would leave behind. It
> may well be an old account of yours — but it is worth two minutes to check.

---

## Step 4 — Fill in your profile

1. Open your site and go to **/admin**, sign in.
2. Click the **Profile** tab.
3. Fill in: name, tagline, about, skills, email, phone.
4. **Fiverr profile URL** — paste it once your gig is live. Leave it empty for
   now and the Fiverr row simply will not appear on the site.
5. Click **Save profile**.

---

## Step 5 — Upload a game

1. **/admin → Add project**.
2. Pick one of the three buttons:
   - **Upload .zip** — a zipped game folder.
   - **Upload folder** — pick the game folder itself. Your browser will ask you
     to confirm uploading multiple files; that is normal.
   - **Paste HTML** — for a single self-contained `.html` file.
3. It will show you how many files it found and which one starts the game.
4. Fill in the title, a short description, and **upload a cover image** — the
   cards look far better with one. A screenshot of the game is perfect. Use a
   wide (16:9) screenshot so nothing gets cropped.
5. Choose the section: **Games** or **Tools & Apps**.
6. Click **Publish**.

Your existing five projects were left exactly as they are and keep working.
Use the **Manage** tab to give them descriptions, cover images, and to move the
ones that are really tools into the Tools section.

### Two things that will stop a game from working

- **Compressed builds.** If your game folder contains files ending in `.gz` or
  `.br`, the upload is blocked with a message. Re-export the game with
  compression turned off. This is a limitation of the file host, not your game.
- **Files over 50 MB each.** The total game size can be much larger; it is any
  single file over 50 MB that is rejected.

---

## Step 6 — Deploy

Push the folder to GitHub as you normally do, and Vercel will build it.
No new environment variables are required.

### Optional: put games on their own web address

This is a security upgrade, and it is one setting.

Right now a game runs on the same web address as your portfolio. If a game ever
contained bad code, it could read your admin login from the browser. Because you
write your own games, the risk is low — but you can remove it completely:

1. In **Vercel → your project → Settings → Environment Variables**.
2. Add a new variable:
   - Name: `NEXT_PUBLIC_GAME_ORIGIN`
   - Value: `https://tech-farhan.vercel.app`
3. Save and redeploy.

Then always use **https://farhanshahriar.online/admin** to sign in — never the
`tech-farhan.vercel.app` address. Games then live on a different web address
from your login, and the browser itself keeps them apart.

---

## If something looks wrong while developing

**Changes not showing up?** This folder is inside OneDrive, and OneDrive
sometimes hides file changes from the development server. Stop the server
(**Ctrl+C**), delete the `.next` folder, and start it again with `npm run dev`.
This is not a bug in your site.

---

## What was fixed along the way

Things that were already broken before this work started:

| Problem | Effect |
| :--- | :--- |
| No delete policy on the database | The delete button reported success and deleted nothing. |
| Anyone could sign up and set their own role to `admin` | Full takeover of the site by a stranger. |
| Any signed-in user could add or edit projects | Same. |
| Games ran with access to your login session | A bad game could steal your admin token. |
| Two admin accounts existed | See Step 3. |
| Homepage asked the database for exactly one admin profile | Two existed, so the query failed and the site showed "Your Name" and a broken photo. |
| Project grid had no page margins | Cards ran edge to edge against the browser window. |
| Browser tab said "Create Next App" | That was also the Google search result. |
| Public visitors saw a link to the admin panel | Shown whenever there were no projects. |
