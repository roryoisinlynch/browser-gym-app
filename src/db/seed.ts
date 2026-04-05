import { openDatabase, STORE_NAMES, transactionDone } from "./db";

import { mockMuscleGroups } from "../data/mockMuscleGroups";
import { mockMovementTypes } from "../data/mockMovementTypes";
import { mockSeasonTemplates } from "../data/mockSeasonTemplates";
import { mockWeekTemplates } from "../data/mockWeekTemplates";
import { mockWeekTemplateItems } from "../data/mockWeekTemplateItems";
import { mockSessionTemplates } from "../data/mockSessionTemplates";
import { mockSessionTemplateMuscleGroups } from "../data/mockSessionTemplateMuscleGroups";
import { mockExerciseTemplates } from "../data/mockExerciseTemplates";

const SEED_KEY = "seed-v4";

export async function seedDatabaseIfNeeded(): Promise<void> {
  const db = await openDatabase();

  const existingSeed = await new Promise<{ key: string; value: boolean } | undefined>(
    (resolve, reject) => {
      const tx = db.transaction(STORE_NAMES.meta, "readonly");
      const request = tx.objectStore(STORE_NAMES.meta).get(SEED_KEY);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }
  );

  if (existingSeed?.value) {
    return;
  }

  const tx = db.transaction(Object.values(STORE_NAMES), "readwrite");

  mockMuscleGroups.forEach((item) =>
    tx.objectStore(STORE_NAMES.muscleGroups).put(item)
  );

  mockMovementTypes.forEach((item) =>
    tx.objectStore(STORE_NAMES.movementTypes).put(item)
  );

  mockSeasonTemplates.forEach((item) =>
    tx.objectStore(STORE_NAMES.seasonTemplates).put(item)
  );

  mockWeekTemplates.forEach((item) =>
    tx.objectStore(STORE_NAMES.weekTemplates).put(item)
  );

  mockWeekTemplateItems.forEach((item) =>
    tx.objectStore(STORE_NAMES.weekTemplateItems).put(item)
  );

  mockSessionTemplates.forEach((item) =>
    tx.objectStore(STORE_NAMES.sessionTemplates).put(item)
  );

  mockSessionTemplateMuscleGroups.forEach((item) =>
    tx.objectStore(STORE_NAMES.sessionTemplateMuscleGroups).put(item)
  );

  mockExerciseTemplates.forEach((item) =>
    tx.objectStore(STORE_NAMES.exerciseTemplates).put(item)
  );

  tx.objectStore(STORE_NAMES.meta).put({
    key: SEED_KEY,
    value: true,
    seededAt: new Date().toISOString(),
  });

  await transactionDone(tx);
}