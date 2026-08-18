# Ehtesab — Daily Tracker

A simple, installable web app for tracking daily prayers, habits, and reading,
with a streak counter, milestone badges, a monthly heatmap, and an **Insights**
dashboard that surfaces your recurring patterns. No login, no backend —
everything is saved in your browser on your device.

**Tracked each day:**
- **Prayers** (Fajr, Zohr, Asr, Maghrib, Isha) — each one has three possible
  states: **Qazaa** (prayed late — flagged as a slip), **Prayed** (on time),
  or **Mosque** (prayed in congregation — the best state). Tap a state to set
  it; tap it again to clear.
- **Habits** — Gym, Upskilling (simple on/off).
- **Reading** — Book and Ayat are now **counts**, not checkboxes: log how many
  pages or how many ayat you read, with a +/− stepper.
- **Slips** — tap any preset ("Missed Fajr," "Junk food," "Doomscrolling"…) or
  add your own custom ones. These feed the Insights page.
- **Reflection** — a mood picker (5 levels) plus two short prompts: *what went
  well* and *what pulled you off track*. Splitting it this way gives the
  Insights page cleaner signal than one open text box would.

**Insights dashboard** (`insights.html`, linked from the tracker):
- Auto-generated notes, e.g. "You hit the gym ~4 days a week, mostly Mon/Wed/Fri/Sat,"
  or "Prayers most often become qazaa on Sunday."
- Weekly-rhythm bar charts per habit and per prayer state, by day of week.
- Your most frequently logged slips, ranked.
- A 14-day mood sparkline.
- Monthly reading totals.

## Run it locally first (optional)

Just open `index.html` in a browser. Everything works without a server.

## Host it free on GitHub Pages

1. Create a new **public** repo on GitHub, e.g. `ehtesab-tracker`.
2. Upload all files in this folder (`index.html`, `insights.html`, `style.css`,
   `app.js`, `insights.js`, `manifest.json`, `sw.js`, and the `icons/` folder)
   to the repo — keep the same folder structure.
   - Easiest way: on the repo page, click **Add file → Upload files**, drag
     everything in, commit.
3. Go to the repo's **Settings → Pages**.
4. Under **Build and deployment**, set **Source** to `Deploy from a branch`,
   branch `main`, folder `/ (root)`. Save.
5. Wait ~1 minute, then your app is live at:
   `https://<your-github-username>.github.io/ehtesab-tracker/`

## Install it on your phone (makes it feel like a real app)

- **iPhone (Safari):** open the link → Share icon → **Add to Home Screen**.
- **Android (Chrome):** open the link → ⋮ menu → **Add to Home screen** / **Install app**.

It'll launch full-screen with its own icon, no browser bar.

## How the streak works

A day counts toward your streak once all **five prayers** are checked for that
day. The streak counts consecutive counted days ending today (if today isn't
finished yet, it still shows yesterday's streak rather than zeroing out mid-day).
Badges at 3, 7, 14, 30, 60, and 100 days stay earned forever once you hit them,
even if a streak later breaks — so progress is never erased.

## Where your data lives

Everything is stored in your browser's `localStorage`, tied to that specific
browser and device. This means:

- Nothing is sent to any server — fully private.
- **Data does not sync** between your phone and laptop, or between browsers.
- Clearing your browser's site data, or uninstalling/reinstalling as a home-screen
  app in some setups, will erase it.

If you outgrow this later and want multi-device sync, the natural next step is
adding a free backend like Supabase or Firebase — happy to help with that when
you're ready.

## Customizing

- Add/remove habits: edit the `PRAYERS` and `HABITS` arrays at the top of `app.js`.
- Change colors: edit the CSS variables at the top of `style.css`.
