const DB_NAME = "browser-gym-app";
const DB_VERSION = 2;

export const STORE_NAMES = {
  muscleGroups: "muscleGroups",
  movementTypes: "movementTypes",
  seasonTemplates: "seasonTemplates",
  weekTemplates: "weekTemplates",
  weekTemplateItems: "weekTemplateItems",
  sessionTemplates: "sessionTemplates",
  sessionTemplateMuscleGroups: "sessionTemplateMuscleGroups",
  exerciseTemplates: "exerciseTemplates",
  seasonInstances: "seasonInstances",
  weekInstances: "weekInstances",
  weekInstanceItems: "weekInstanceItems",
  sessionInstances: "sessionInstances",
  exerciseInstances: "exerciseInstances",
  exerciseSets: "exerciseSets",
  meta: "meta",
} as const;

export type StoreName = (typeof STORE_NAMES)[keyof typeof STORE_NAMES];

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAMES.muscleGroups)) {
        db.createObjectStore(STORE_NAMES.muscleGroups, { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains(STORE_NAMES.movementTypes)) {
        const store = db.createObjectStore(STORE_NAMES.movementTypes, {
          keyPath: "id",
        });
        store.createIndex("byMuscleGroupId", "muscleGroupId", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_NAMES.seasonTemplates)) {
        db.createObjectStore(STORE_NAMES.seasonTemplates, { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains(STORE_NAMES.weekTemplates)) {
        const store = db.createObjectStore(STORE_NAMES.weekTemplates, {
          keyPath: "id",
        });
        store.createIndex("bySeasonTemplateId", "seasonTemplateId", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_NAMES.weekTemplateItems)) {
        const store = db.createObjectStore(STORE_NAMES.weekTemplateItems, {
          keyPath: "id",
        });
        store.createIndex("byWeekTemplateId", "weekTemplateId", { unique: false });
        store.createIndex("bySessionTemplateId", "sessionTemplateId", {
          unique: false,
        });
      }

      if (!db.objectStoreNames.contains(STORE_NAMES.sessionTemplates)) {
        const store = db.createObjectStore(STORE_NAMES.sessionTemplates, {
          keyPath: "id",
        });
        store.createIndex("byWeekTemplateId", "weekTemplateId", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_NAMES.sessionTemplateMuscleGroups)) {
        const store = db.createObjectStore(STORE_NAMES.sessionTemplateMuscleGroups, {
          keyPath: "id",
        });
        store.createIndex("bySessionTemplateId", "sessionTemplateId", {
          unique: false,
        });
        store.createIndex("byMuscleGroupId", "muscleGroupId", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_NAMES.exerciseTemplates)) {
        const store = db.createObjectStore(STORE_NAMES.exerciseTemplates, {
          keyPath: "id",
        });
        store.createIndex(
          "bySessionTemplateMuscleGroupId",
          "sessionTemplateMuscleGroupId",
          { unique: false }
        );
        store.createIndex("byMovementTypeId", "movementTypeId", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_NAMES.seasonInstances)) {
        const store = db.createObjectStore(STORE_NAMES.seasonInstances, {
          keyPath: "id",
        });
        store.createIndex("bySeasonTemplateId", "seasonTemplateId", {
          unique: false,
        });
        store.createIndex("byStatus", "status", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_NAMES.weekInstances)) {
        const store = db.createObjectStore(STORE_NAMES.weekInstances, {
          keyPath: "id",
        });
        store.createIndex("bySeasonInstanceId", "seasonInstanceId", { unique: false });
        store.createIndex("byWeekTemplateId", "weekTemplateId", { unique: false });
        store.createIndex("byStatus", "status", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_NAMES.weekInstanceItems)) {
        const store = db.createObjectStore(STORE_NAMES.weekInstanceItems, {
          keyPath: "id",
        });
        store.createIndex("byWeekInstanceId", "weekInstanceId", { unique: false });
        store.createIndex("byWeekTemplateItemId", "weekTemplateItemId", {
          unique: false,
        });
        store.createIndex("bySessionInstanceId", "sessionInstanceId", {
          unique: false,
        });
      }

      if (!db.objectStoreNames.contains(STORE_NAMES.sessionInstances)) {
        const store = db.createObjectStore(STORE_NAMES.sessionInstances, {
          keyPath: "id",
        });
        store.createIndex("bySeasonInstanceId", "seasonInstanceId", { unique: false });
        store.createIndex("byWeekInstanceId", "weekInstanceId", { unique: false });
        store.createIndex("bySessionTemplateId", "sessionTemplateId", {
          unique: false,
        });
      }

      if (!db.objectStoreNames.contains(STORE_NAMES.exerciseInstances)) {
        const store = db.createObjectStore(STORE_NAMES.exerciseInstances, {
          keyPath: "id",
        });
        store.createIndex("bySessionInstanceId", "sessionInstanceId", {
          unique: false,
        });
        store.createIndex("byExerciseTemplateId", "exerciseTemplateId", {
          unique: false,
        });
        store.createIndex(
          "bySessionAndTemplate",
          ["sessionInstanceId", "exerciseTemplateId"],
          { unique: true }
        );
      }

      if (!db.objectStoreNames.contains(STORE_NAMES.exerciseSets)) {
        const store = db.createObjectStore(STORE_NAMES.exerciseSets, {
          keyPath: "id",
        });
        store.createIndex("byExerciseInstanceId", "exerciseInstanceId", {
          unique: false,
        });
      }

      if (!db.objectStoreNames.contains(STORE_NAMES.meta)) {
        db.createObjectStore(STORE_NAMES.meta, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
  });

  return dbPromise;
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function getById<T>(
  storeName: StoreName,
  id: IDBValidKey
): Promise<T | undefined> {
  const db = await openDatabase();
  const tx = db.transaction(storeName, "readonly");
  const store = tx.objectStore(storeName);
  return promisifyRequest(store.get(id));
}

export async function getAll<T>(storeName: StoreName): Promise<T[]> {
  const db = await openDatabase();
  const tx = db.transaction(storeName, "readonly");
  const store = tx.objectStore(storeName);
  return promisifyRequest(store.getAll());
}

export async function getAllByIndex<T>(
  storeName: StoreName,
  indexName: string,
  key: IDBValidKey | IDBKeyRange
): Promise<T[]> {
  const db = await openDatabase();
  const tx = db.transaction(storeName, "readonly");
  const index = tx.objectStore(storeName).index(indexName);
  return promisifyRequest(index.getAll(key));
}

export async function putItem<T>(storeName: StoreName, value: T): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(storeName, "readwrite");
  tx.objectStore(storeName).put(value);
  await transactionDone(tx);
}

export async function bulkPutItems<T>(
  storeName: StoreName,
  values: T[]
): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);

  for (const value of values) {
    store.put(value);
  }

  await transactionDone(tx);
}

export async function deleteItem(
  storeName: StoreName,
  id: IDBValidKey
): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(storeName, "readwrite");
  tx.objectStore(storeName).delete(id);
  await transactionDone(tx);
}

export async function clearStore(storeName: StoreName): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(storeName, "readwrite");
  tx.objectStore(storeName).clear();
  await transactionDone(tx);
}

export async function resetDatabase(): Promise<void> {
  const db = await openDatabase();
  db.close();
  dbPromise = null;

  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Database deletion blocked"));
  });
}