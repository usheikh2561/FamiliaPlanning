# 📅 FamiliaPlanning

A shared family calendar that ends the "does this weekend work? does *that* one?"
back-and-forth. Everyone marks which weekends they're **Free / Maybe / Busy**, and
the app automatically suggests the weekends that work for the most people — perfect
for planning trips together.

## What it does (version 1)

- **Add family members** by name.
- **Weekend availability grid** — the next 12 weekends, where each person taps
  Free / Maybe / Busy.
- **"Best weekends" suggestions** that rank weekends by how many people are free,
  updating live as answers come in.
- **Works instantly on your device**, and connects to a **free shared cloud
  database** so the whole family sees one calendar from their own phones.

## Try it in 2 minutes

Open `index.html` in your browser (see `SETUP.md` if the page looks blank), add a
couple of names, and start tapping weekends. No accounts needed to test.

## Share it with the family

Follow **[`SETUP.md`](./SETUP.md)** — a step-by-step, beginner-friendly guide to:
1. Creating a free [Supabase](https://supabase.com) cloud database.
2. Pasting two keys into `config.js`.
3. Putting the app online for free (GitHub Pages) so everyone gets a link.

## Project files

| File | What it's for |
| --- | --- |
| `index.html` | The page layout (what you see). |
| `styles.css` | The look and colors. |
| `app.js` | The app's logic (weekends, voting, suggestions, saving). |
| `config.js` | Where you paste your Supabase keys (optional). |
| `supabase-schema.sql` | Run this once in Supabase to create the database tables. |
| `SETUP.md` | Beginner setup + hosting guide. |

## Ideas for later

- Calendar import (Google/Apple) so busy times fill in automatically.
- Specific date ranges or weekday trips, not just weekends.
- A simple login per family member.
- "Add to Home Screen" app icon (PWA), then native apps via Capacitor.

Built with plain HTML, CSS, and JavaScript — no build tools — so it's easy to read
and learn from.
