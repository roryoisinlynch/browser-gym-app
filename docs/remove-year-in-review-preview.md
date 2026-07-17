# Removing the temporary "Preview Year in Review" feature

**Status: pending removal.** Delete this file as part of the removal commit, along with the pointer line in `CLAUDE.md`.

## Why it exists

The Year in Review feature (commit `85fc10a`) is gated to Dec 25 - Jan 31 and production builds originally stripped the dev-only date override, so there was no way to test it on the live PWA before December. Commit `8205983` (2026-07-17) added a temporary Settings card that simulates Dec 26 via a `yearReviewNow` localStorage override, now honored in all builds.

## When to remove

Once Rory confirms the feature works via the preview, or at the latest after the first real window closes (after 2027-01-31). Ask before removing if neither has clearly happened.

## What to remove

All temporary code is marked with `TEMPORARY` comments. `grep -rn "TEMPORARY" src/` should find every site; as of writing there are exactly three files:

### 1. `src/pages/SettingsPage.tsx`

- The import of `endYearInReviewPreview`, `isYearInReviewPreviewActive`, `startYearInReviewPreview` from `../services/yearInReview`.
- The `yirPreviewOn` state (`useState(() => isYearInReviewPreviewActive())`).
- The `handleYirPreview` function (has a TEMPORARY comment).
- The entire "Preview" settings section JSX (a `settings-section` div labelled `Preview`, preceded by a TEMPORARY comment), located just above the "Danger zone" section.

### 2. `src/services/yearInReview.ts`

- The whole `TEMPORARY: Settings preview` section: `isYearInReviewPreviewActive`, `startYearInReviewPreview`, `endYearInReviewPreview`.
- The import of `clearYearInReviewPromptFlag` from `../repositories/yearInReviewRepository` (only the preview helpers use it).
- Recommended: re-gate the localStorage override in `getReviewNow()` behind dev builds so production ignores stale overrides, restoring:

```ts
/**
 * "Now" for every year-in-review gate. In dev builds it honors a
 * localStorage override ("yearReviewNow", any Date-parsable string) so the
 * window and year logic can be exercised without changing the system clock.
 * Dead-code-eliminated in production.
 */
export function getReviewNow(): Date {
  if (import.meta.env.DEV) {
    const override = localStorage.getItem(YEAR_REVIEW_NOW_KEY);
    if (override) {
      const d = new Date(override);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return new Date();
}
```

### 3. `src/repositories/yearInReviewRepository.ts`

- `clearYearInReviewPromptFlag` becomes unused: remove it and drop `deleteItem` from the `../db/db` import (tsc does not flag unused exports, so this is manual).

## User-data notes (no migration needed)

- A device may still carry the `yearReviewNow` localStorage key after removal; with the override re-gated, production ignores it. Harmless.
- A device where the preview burned or cleared the `year_in_review_prompt_seen_<year>` meta flag may see the app-open interstitial once more (or not at all) in the real window. Accepted; matches how tutorial-dismissal flags behave across backup restores.
- Backups are unaffected (the flag is an ordinary meta row).

## Verification

1. `grep -rn "TEMPORARY" src/` and `grep -rni "yirPreview\|YearInReviewPreview" src/` both return nothing.
2. `npm run build` run bare, checking the exit code (piping through `tail` masks tsc failures).
3. Optional runtime check per `.claude/skills/verify/SKILL.md`: on the production build (`npm run preview`) at a phone viewport with today's real date outside the window, Settings shows no Preview card, the dashboard shows no Year in Review CTA or interstitial, and `/year-in-review` redirects to `/`; with a `yearReviewNow` localStorage key set, production still shows nothing (override re-gated).
4. Commit and push per the CLAUDE.md chained workflow (source change, so the full build chain applies). Delete this file and the CLAUDE.md pointer line in the same commit.
