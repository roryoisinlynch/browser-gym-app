---
name: verify
description: Build, launch, and drive this app in a headless browser to verify changes at the real surface.
---

# Verifying browser-gym-app

Mobile-only React PWA (Vite, IndexedDB). Surface = browser GUI at a phone viewport.

## Build / launch

- `npm run build` — `tsc -b && vite build`. Run it bare and check the exit code; piping through `tail` masks tsc failures.
- `npm run dev` — Vite dev server at `http://localhost:5173/browser-gym-app/` (note the base path). Run in background.

## Drive

- Playwright works with the system Edge channel, no browser download: `npm i playwright` in a scratch dir, then `chromium.launch({ channel: "msedge", headless: true })`.
- Use a phone viewport (`390x844`, `deviceScaleFactor: 2`); widths >= 1024 hit the desktop QR gate on Dashboard and Year in Review.
- Each Playwright launch is a fresh profile: IndexedDB starts empty (app seeds templates only, no performed data). Fastest way to fabricate a training history is writing rows to the `importedSets` store via `page.evaluate` (shape: `{ id, exerciseName, weight, reps, date: "YYYY-MM-DD" }`); they feed set records, PR events, and exercise history. Native session data needs many linked records; avoid fabricating it.
- Time travel (dev builds only): `localStorage.setItem("yearReviewNow", "<ISO date>")` overrides "now" for all Year in Review gates (window, review year, interstitial, CTA). Set it after first navigation, then reload.
- Hidden Year in Review preview (all builds): navigating to `/year-in-review?preview` renders the deck outside the real window (bare = last year, `?preview=YYYY` = a specific review year); it bypasses this page's date gate only, not the interstitial or dashboard CTA. In-app (no address bar in the standalone PWA) it is reached by tapping the "Settings" title five times quickly, which reveals a year selector listing the years that have data.
- One-time flags live in the `meta` store (`browser-gym-app` DB), e.g. `year_in_review_prompt_seen_<year>`, `tutorial_dismissed_*`. Read/delete them via `page.evaluate` with plain indexedDB to test once-only behavior.

## Gotchas

- Entry animations use `animation-fill-mode: backwards` with delays: screenshots taken < ~1.5s after a slide change catch elements mid-reveal or still hidden. Wait ~2.5s for settled frames.
- The app is dark-theme only; thin grey strokes are nearly invisible in screenshots. Check the DOM (computed styles) before concluding an SVG element is missing.
- Vite prints the real port on startup; 5173 bumps to 5174 if busy.
