import { openDatabase, STORE_NAMES, transactionDone } from "./db";
import type { StoreName } from "./db";

import { buildSeedData } from "../data/seedProgram";

const ALL_STORES = Object.values(STORE_NAMES) as StoreName[];

// True when any object store holds at least one record. Read-only, so a
// database that already has data is never opened for writing here.
async function databaseHasData(db: IDBDatabase): Promise<boolean> {
  const tx = db.transaction(ALL_STORES, "readonly");
  const counts = await Promise.all(
    ALL_STORES.map(
      (name) =>
        new Promise<number>((resolve, reject) => {
          const request = tx.objectStore(name).count();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        })
    )
  );
  return counts.some((count) => count > 0);
}

export async function seedDatabaseIfNeeded(): Promise<void> {
  const db = await openDatabase();

  // Only seed a blank database: a first launch, or the reload after an
  // explicit reset (Settings → Reset database). A record in any store means
  // the user has real data, so nothing is touched. That holds even when every
  // program has been deleted: muscle groups and history outlive the programs,
  // and the sample program must not come back on its own.
  if (await databaseHasData(db)) {
    return;
  }

  const seed = buildSeedData();
  const tx = db.transaction(ALL_STORES, "readwrite");

  seed.muscleGroups.forEach((item) =>
    tx.objectStore(STORE_NAMES.muscleGroups).put(item)
  );

  seed.movementTypes.forEach((item) =>
    tx.objectStore(STORE_NAMES.movementTypes).put(item)
  );

  seed.seasonTemplates.forEach((item) =>
    tx.objectStore(STORE_NAMES.seasonTemplates).put(item)
  );

  seed.weekTemplates.forEach((item) =>
    tx.objectStore(STORE_NAMES.weekTemplates).put(item)
  );

  seed.weekTemplateItems.forEach((item) =>
    tx.objectStore(STORE_NAMES.weekTemplateItems).put(item)
  );

  seed.sessionTemplates.forEach((item) =>
    tx.objectStore(STORE_NAMES.sessionTemplates).put(item)
  );

  seed.sessionTemplateMuscleGroups.forEach((item) =>
    tx.objectStore(STORE_NAMES.sessionTemplateMuscleGroups).put(item)
  );

  seed.exerciseTemplates.forEach((item) =>
    tx.objectStore(STORE_NAMES.exerciseTemplates).put(item)
  );

  await transactionDone(tx);
}
