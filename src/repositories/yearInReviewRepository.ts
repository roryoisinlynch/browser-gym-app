import { STORE_NAMES, deleteItem, getById, putItem } from "../db/db";

type MetaRecord = { key: string; value: string };

// Keyed by review year so the Dec/Jan halves of one window share a single
// flag while next year's window mints a fresh one.
const META_KEY_PREFIX = "year_in_review_prompt_seen_";

function metaKey(reviewYear: number): string {
  return `${META_KEY_PREFIX}${reviewYear}`;
}

export async function hasSeenYearInReviewPrompt(reviewYear: number): Promise<boolean> {
  const rec = await getById<MetaRecord>(STORE_NAMES.meta, metaKey(reviewYear));
  return rec?.value === "true";
}

export async function markYearInReviewPromptSeen(reviewYear: number): Promise<void> {
  await putItem(STORE_NAMES.meta, { key: metaKey(reviewYear), value: "true" });
}

export async function clearYearInReviewPromptFlag(reviewYear: number): Promise<void> {
  await deleteItem(STORE_NAMES.meta, metaKey(reviewYear));
}
