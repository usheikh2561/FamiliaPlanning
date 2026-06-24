# Setting up FamiliaPlanning 🪜

This guide is written for a beginner. Take it one step at a time — there's
nothing here you can break, and every tool below has a free plan.

---

## Part 1 — Try it on your computer (2 minutes, no accounts)

The app works immediately, saving data in your own browser.

1. Download/clone this project to your computer.
2. Open the project folder.
3. **Double-click `index.html`** — it opens in your web browser.

> 💡 Some browsers are picky about the modern code we use when opening a file
> directly. If the page looks blank, start a tiny local server instead:
> - If you have Python: open a terminal in the project folder and run
>   `python3 -m http.server 8000`, then visit **http://localhost:8000**
> - Or install the free "Live Server" extension in VS Code and click "Go Live".

At this point: add a couple of names, pick who you are, and click a few days to
mark yourself busy. Watch the "Best upcoming days" panel update. This data lives
only on your device for now.

---

## Part 2 — Share it with the family (the cloud database)

To let everyone use one shared calendar from their own phones, we connect a
free **Supabase** database. ~10 minutes, one time.

### Step 1 — Create a free Supabase project
1. Go to **https://supabase.com** and sign up (free).
2. Click **New project**. Give it a name like `familiaplanning`.
3. Set a database password (save it somewhere) and pick the region closest to you.
4. Wait ~1 minute for it to finish setting up.

### Step 2 — Create the tables
1. In your project, open the **SQL Editor** (left sidebar).
2. Click **New query**.
3. Open the file **`supabase-schema.sql`** from this project, copy everything,
   paste it in, and click **Run**. You should see "Success".

### Step 3 — Get your two keys
1. In Supabase, go to **Project Settings → API** (or **Settings → API**).
2. Copy the **Project URL** (looks like `https://abcdxyz.supabase.co`).
3. Copy the **anon public** key (a long string).

> These are safe to put in your code. The database rules control access.

### Step 4 — Paste them into `config.js`
Open **`config.js`** in this project and fill in the two values:

```js
export const SUPABASE_URL = "https://abcdxyz.supabase.co";
export const SUPABASE_ANON_KEY = "paste-the-long-anon-key-here";
```

Save the file and reload the app. The badge at the top should now say
**"☁️ Connected to the family cloud"**. 🎉

---

## Part 3 — Put it online so family can open a link

Right now only you can open the files. To give everyone a link, host it for
free. The easiest option, since this is already a GitHub repo:

### Option A — GitHub Pages (free, easiest here)
1. On GitHub, go to your repo → **Settings → Pages**.
2. Under "Build and deployment", set **Source: Deploy from a branch**.
3. Choose branch **main** (or your branch) and folder **/(root)**, then **Save**.
4. After a minute, GitHub gives you a link like
   `https://usheikh2561.github.io/familiaplanning`. Share that with the family!

### Option B — Netlify or Vercel (also free)
Drag-and-drop the project folder onto **app.netlify.com/drop**, and you get a
link instantly. Good if you ever outgrow GitHub Pages.

---

## Frequently asked

**Is my family's data private?**
Only people with your link can reach the app. For a small family tool that's
usually enough. If you later want each person to log in, that's a feature we
can add — just ask.

**Will it cost money?**
No, everything above stays within free tiers for a family-sized app.

**Can this become a real phone app later?**
Yes. Because it's a web app, your family can already "Add to Home Screen" for
an app-like icon. If it really takes off, a tool called *Capacitor* can wrap
this same code into iOS/Android apps.

**I'm stuck.**
Tell me which step number and what you see on screen, and I'll walk you through it.
