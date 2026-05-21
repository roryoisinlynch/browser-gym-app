import { STORE_NAMES, getAll, getById, putItem, deleteItem } from "../db/db";

export const TUTORIAL_IDS = [
  "schedule",
  "reports",
  "metrics",
  "exercise_graph",
  "recent_prs",
  "pr_spotlight",
  "achievements",
  "programs",
  "weeks_breadcrumb",
  "all_seasons",
  "exercise_summary_card",
] as const;

export type TutorialId = (typeof TUTORIAL_IDS)[number];

type MetaRecord = { key: string; value: string };

const META_KEY_PREFIX = "tutorial_dismissed_";

function metaKey(id: TutorialId): string {
  return `${META_KEY_PREFIX}${id}`;
}

export async function isTutorialDismissed(id: TutorialId): Promise<boolean> {
  const rec = await getById<MetaRecord>(STORE_NAMES.meta, metaKey(id));
  return rec?.value === "true";
}

export async function dismissTutorial(id: TutorialId): Promise<void> {
  await putItem(STORE_NAMES.meta, { key: metaKey(id), value: "true" });
}

export async function resetAllTutorials(): Promise<void> {
  const all = await getAll<MetaRecord>(STORE_NAMES.meta);
  await Promise.all(
    all
      .filter((rec) => rec.key.startsWith(META_KEY_PREFIX))
      .map((rec) => deleteItem(STORE_NAMES.meta, rec.key))
  );
}
