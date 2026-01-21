# Deployment Guide: Vercel

Since your project uses Next.js and Supabase, **Vercel** is the best place to host it. It is free for hobby projects and works seamlessly with Next.js.

## 1. Prepare your Project
1.  Make sure your project is pushed to a **GitHub Repository**.
    *   If you haven't done this yet, download GitHub Desktop or use the command line to push your code to a new repository.

## 2. Create Vercel Account
1.  Go to [vercel.com](https://vercel.com) and Sign Up.
2.  Login with **GitHub**.

## 3. Import Project
1.  On your Vercel Dashboard, click **"Add New..."** -> **"Project"**.
2.  Import the GitHub repository you just created (e.g., `spell-website`).

## 4. Configure Environment Variables (CRITICAL)
Vercel needs to know your Supabase keys to connect to the database.

1.  On the "Configure Project" screen, look for the **"Environment Variables"** section.
2.  Open your local `.env.local` file (in your project folder).
3.  Copy and paste the keys one by one into Vercel:

| Key | Value |
| :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | *paste your url here* |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *paste your anon key here* |

4.  Click **Add** for each one.

## 5. Deploy
1.  Click **"Deploy"**.
2.  Wait a minute or two. Vercel will build your site.
3.  Once done, you will get a live URL (e.g., `https://your-project.vercel.app`).

## 6. Update Supabase Auth URL (IMPORTANT)
For Google Auth (or even Email links) to work on the live site, Supabase needs to know your new domain.

1.  Go to your **Supabase Dashboard** -> **Authentication** -> **URL Configuration**.
2.  In **Site URL**, paste your new Vercel URL (e.g., `https://spell-website.vercel.app`).
3.  In **Redirect URLs**, add:
    *   `https://spell-website.vercel.app/**`

Save changes.

## 7. Verify
Visit your new Vercel URL. Your portfolio should be live!

---

## Alternative: Netlify
If you prefer Netlify:
1.  Login to Netlify with GitHub.
2.  "Add new site" -> "Import an existing project".
3.  Select your repo.
4.  Add the same Environment Variables in "Site settings" -> "Build & deploy" -> "Environment".
5.  Deploy.
