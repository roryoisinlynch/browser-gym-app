import { openDatabase, STORE_NAMES, transactionDone } from "./db";

import { mockMuscleGroups } from "../data/mockMuscleGroups";
import { mockMovementTypes } from "../data/mockMovementTypes";
import { mockSeasonTemplates } from "../data/mockSeasonTemplates";
import { mockWeekTemplates } from "../data/mockWeekTemplates";
import { mockWeekTemplateItems } from "../data/mockWeekTemplateItems";
import { mockSessionTemplates } from "../data/mockSessionTemplates";
import { mockSessionTemplateMuscleGroups } from "../data/mockSessionTemplateMuscleGroups";
import { mockExerciseTemplates } from "../data/mockExerciseTemplates";

export async function seedDatabaseIfNeeded(): Promise<void> {
  const db = await openDatabase();

  // Only seed a blank database. If any season templates already exist the user
  // has real data — leave everything untouched. The seed runs again only after
  // an explicit database reset (Settings → Reset database).
  const hasData = await new Promise<boolean>((resolve, reject) => {
    const tx = db.transaction(STORE_NAMES.seasonTemplates, "readonly");
    const request = tx.objectStore(STORE_NAMES.seasonTemplates).count();
    request.onsuccess = () => resolve(request.result > 0);
    request.onerror = () => reject(request.error);
  });

  if (hasData) {
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

  await transactionDone(tx);
}
