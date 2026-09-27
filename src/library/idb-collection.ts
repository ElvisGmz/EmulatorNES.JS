const DATABASE_NAME = "emulator-nes-js";
const DATABASE_VERSION = 1;

export type CollectionName = "roms" | "snapshots";

const COLLECTION_KEY_PATHS: Record<CollectionName, string> = {
  roms: "id",
  snapshots: "romId",
};

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  databasePromise ??= new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available"));
      return;
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      for (const [name, keyPath] of Object.entries(COLLECTION_KEY_PATHS)) {
        if (!request.result.objectStoreNames.contains(name)) {
          request.result.createObjectStore(name, { keyPath });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  databasePromise.catch(() => {
    databasePromise = null;
  });
  return databasePromise;
}

async function runRequest<T>(
  collection: CollectionName,
  mode: IDBTransactionMode,
  createRequest: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = createRequest(database.transaction(collection, mode).objectStore(collection));
    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error);
  });
}

export interface Collection<T> {
  getAll(): Promise<T[]>;
  get(key: string): Promise<T | undefined>;
  put(value: T): Promise<void>;
  delete(key: string): Promise<void>;
}

export function createIdbCollection<T>(name: CollectionName): Collection<T> {
  return {
    getAll: () => runRequest(name, "readonly", (store) => store.getAll()),
    get: (key) => runRequest(name, "readonly", (store) => store.get(key)),
    put: (value) => runRequest(name, "readwrite", (store) => store.put(value)),
    delete: (key) => runRequest(name, "readwrite", (store) => store.delete(key)),
  };
}
