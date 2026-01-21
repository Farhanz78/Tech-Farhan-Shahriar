# How to Deploy to Vercel (Step-by-Step)

Your local build was **Successful**! Your project is 100% ready to go live.
Follow these exact steps to put your portfolio on the internet.

---

## 🛠️ TROUBLESHOOTING (Read this if you have errors)
If you see **"npm run build failed"** or issues with uploading:

1.  **Large File Error**: You have a huge `spell website.zip` file. GitHub rejects files larger than 100MB.
    *   **Fix**: I have updated your `.gitignore` to ignore it. if you already tried to push it, you might need to delete the `.git` folder and start Phase 1 again.

2.  **NPM Error**: Sometimes Windows and Linux `package-lock.json` versions conflict.
    *   **Fix**: 
        1. Delete `package-lock.json` from your folder.
        2. Delete `node_modules` folder.
        3. Run `npm install` in your terminal.
        4. Push the new `package-lock.json` to GitHub.

---

## Phase 1: Upload Code to GitHub
Vercel needs your code to be on GitHub first.

1.  **Create a Repo**:
    *   Go to [github.com](https://github.com) and sign in.
    *   Click the **+** (top right) -> **New repository**.
    *   Repository Name: `spell-portfolio` (or anything you like).
    *   Visibility: **Public** (or Private).
    *   Click **Create repository**.

2.  **Push your Code**:
    *   Open your project folder (`spell website`) in VS Code or Terminal.
    *   Run these commands (if you haven't already linked it):
    ```bash
    # IF you have already initialized git, skip 'git init'
    git init
    git add .
    git commit -m "Deployment fix"
    git branch -M main
    git remote add origin https://github.com/YOUR_USERNAME/spell-portfolio.git
    git push -u origin main
    ```
    *(Replace `YOUR_USERNAME` with your actual GitHub username)*

---

## Phase 2: Connect to Vercel
1.  Go to [vercel.com](https://vercel.com) and log in (use "Continue with GitHub").
2.  On your Dashboard, click **Add New...** -> **Project**.
3.  You should see your new `spell-portfolio` repository in the list. Click **Import**.

---

## Phase 3: Environment Variables (VERY IMPORTANT)
This is the most critical step. If you miss this, the site will look blank.

1.  On the "Configure Project" screen, scroll down to **Environment Variables**.
2.  Open your local `.env.local` file to see your keys.
3.  Add them carefully into Vercel:

    | Name | Value |
    | :--- | :--- |
    | `NEXT_PUBLIC_SUPABASE_URL` | *(Copy from your .env.local)* |
    | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(Copy from your .env.local)* |

4.  Click **Deploy**.
5.  Wait about 1-2 minutes. You will see fireworks when it's done! 🚀

---

## Phase 4: Configure Supabase
Your site is live, but Login won't work yet because Supabase doesn't know your new Website URL.

1.  Copy your new Vercel URL (e.g., `https://spell-portfolio.vercel.app`).
2.  Go to your **Supabase Dashboard** -> **Authentication** -> **URL Configuration**.
3.  **Site URL**: Paste your Vercel URL here.
4.  **Redirect URLs**: Add `https://spell-portfolio.vercel.app/**` to the list.
5.  Click **Save**.

---

## Phase 5: Test It!
1.  Open your Vercel URL.
2.  Try logging into `/admin` with `test@example.com` / `123456`.
3.  If it works, you are fully live! Congratulations! 🥳
