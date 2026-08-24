import type {
  DefaultsCatalog,
  SavedDefaultsMapEntry,
  SavedDefaultsMapRecord,
} from "./catalog.ts";

const DB_NAME = "intehrgrator-defaults";
const STORE = "maps";
const DB_VERSION = 1;

/** Host-stored named Defaults Maps (Web Shell / VS Code webview IndexedDB). */
export function createIndexedDbDefaultsCatalog(): DefaultsCatalog {
  return {
    async list() {
      const records = await listRecords();
      return records
        .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
        .map(({ id, displayName, savedAt }) => ({ id, displayName, savedAt }));
    },
    async save(displayName, mapBlock) {
      const record: SavedDefaultsMapRecord = {
        id: crypto.randomUUID(),
        displayName: displayName.trim() || "Defaults",
        savedAt: new Date().toISOString(),
        mapBlock,
      };
      await putRecord(record);
      return { id: record.id, displayName: record.displayName, savedAt: record.savedAt };
    },
    async load(id) {
      const record = await getRecord(id);
      return record?.mapBlock ?? null;
    },
  };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putRecord(record: SavedDefaultsMapRecord): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(record, record.id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function getRecord(id: string): Promise<SavedDefaultsMapRecord | null> {
  const db = await openDb();
  const result = await new Promise<SavedDefaultsMapRecord | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(id);
    request.onsuccess = () => resolve(request.result as SavedDefaultsMapRecord | undefined);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return result ?? null;
}

async function listRecords(): Promise<SavedDefaultsMapRecord[]> {
  const db = await openDb();
  const result = await new Promise<SavedDefaultsMapRecord[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).getAll();
    request.onsuccess = () => resolve((request.result ?? []) as SavedDefaultsMapRecord[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return result;
}
