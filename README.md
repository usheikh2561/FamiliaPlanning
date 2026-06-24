# 📅 FamiliaPlanning

A shared family calendar that ends the "does this weekend work? does *that* one?"
back-and-forth. Everyone marks which weekends they're **Free / Maybe / Busy**, and
the app automatically suggests the weekends that work for the most people — perfect
for planning trips together.

## What it does

- **Add family members** by name and pick "who you are" to edit your own days.
- **Full month calendar** (weekdays *and* weekends) you can page through, ahead as
  far as you like.
- **Mark when you're busy, not when you're free.** Everyone is free by default;
  you only mark the days you *can't* make it — and the app figures out the rest.
- **Reasons with icons** — say *why* a day is busy (work 💼, vacation 🏖️,
  wedding 💒, visiting family 👪, and more), shown right on the calendar with a legend.
- **Dropdown editor** — click any day to set Free / Maybe / Busy and a reason.
- **Multi-day ranges** — mark a whole trip or busy week in one go with an optional
  "through" date.
- **Two views** — toggle between **My calendar** (edit your own days) and
  **Everyone** (a green/amber/red heat-map of the whole family's availability).
- **"Best upcoming days" suggestions** that rank the next ~2 months by how many
  people are free, updating live.
- **Works instantly on your device**, and connects to a **free shared cloud
  database** so the whole family sees one calendar from their own phones.

## Try it in 2 minutes

Open the app (see `SETUP.md`), add a couple of names, pick who you are, and click a
few days to mark yourself busy. Watch the "Best upcoming days" panel react. No
accounts needed to test.

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
