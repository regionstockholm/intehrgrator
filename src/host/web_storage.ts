import type { ProjectBundle } from "../types/mod.ts";
import {
  AUTOSAVE_STORAGE_KEY,
  type LoadableProjectEntry,
  MANUAL_SAVE_KEY_PREFIX,
  MAX_MANUAL_SAVES,
  type StoredProjectRecord,
} from "../core/persistence/mod.ts";

const DB_NAME = "intehrgrator";
const DB_SAVES_STORE = "saves";

export async function saveAutosave(bundle: ProjectBundle): Promise<void> {
  await putStoredRecord({
    storageKey: AUTOSAVE_STORAGE_KEY,
    kind: "autosave",
    displayName: "Autosave",
    savedAt: new Date().toISOString(),
    bundle,
  });
}

export async function saveManualSave(
  bundle: ProjectBundle,
  displayName: string,
): Promise<void> {
  await putStoredRecord({
    storageKey: `${MANUAL_SAVE_KEY_PREFIX}${crypto.randomUUID()}`,
    kind: "manual",
    displayName: displayName.trim(),
    savedAt: new Date().toISOString(),
    bundle,
  });
  await pruneManualSaves();
}

export async function loadStoredProjectRecord(
  storageKey: string,
): Promise<StoredProjectRecord | null> {
  return await getStoredRecord(storageKey);
}

export async function listLoadableProjects(): Promise<LoadableProjectEntry[]> {
  const records = await listStoredRecords();
  const autosave = records.find((record) => record.storageKey === AUTOSAVE_STORAGE_KEY);
  const manual = records
    .filter((record) => record.kind === "manual")
    .sort((left, right) => right.savedAt.localeCompare(left.savedAt))
    .slice(0, MAX_MANUAL_SAVES);
  return [
    ...(autosave ? [toEntry(autosave)] : []),
    ...manual.map(toEntry),
  ];
}

function toEntry(record: StoredProjectRecord): LoadableProjectEntry {
  return {
    storageKey: record.storageKey,
    kind: record.kind,
    displayName: record.displayName,
    savedAt: record.savedAt,
  };
}

async function putStoredRecord(record: StoredProjectRecord): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DB_SAVES_STORE, "readwrite");
    tx.objectStore(DB_SAVES_STORE).put(record, record.storageKey);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function getStoredRecord(storageKey: string): Promise<StoredProjectRecord | null> {
  const db = await openDb();
  const result = await new Promise<StoredProjectRecord | undefined>((resolve, reject) => {
    const tx = db.transaction(DB_SAVES_STORE, "readonly");
    const request = tx.objectStore(DB_SAVES_STORE).get(storageKey);
    request.onsuccess = () => resolve(request.result as StoredProjectRecord | undefined);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return result ?? null;
}

async function listStoredRecords(): Promise<StoredProjectRecord[]> {
  const db = await openDb();
  const result = await new Promise<StoredProjectRecord[]>((resolve, reject) => {
    const tx = db.transaction(DB_SAVES_STORE, "readonly");
    const request = tx.objectStore(DB_SAVES_STORE).getAll();
    request.onsuccess = () => resolve((request.result ?? []) as StoredProjectRecord[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return result;
}

async function pruneManualSaves(): Promise<void> {
  const stale = (await listStoredRecords())
    .filter((record) => record.kind === "manual")
    .sort((left, right) => right.savedAt.localeCompare(left.savedAt))
    .slice(MAX_MANUAL_SAVES);
  if (!stale.length) return;

  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DB_SAVES_STORE, "readwrite");
    const store = tx.objectStore(DB_SAVES_STORE);
    for (const record of stale) store.delete(record.storageKey);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_SAVES_STORE)) {
        db.createObjectStore(DB_SAVES_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
