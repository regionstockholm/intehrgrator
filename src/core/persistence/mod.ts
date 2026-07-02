import { compressSync, decompressSync, strToU8, strFromU8, zipSync, unzipSync } from "fflate";
import type { ProjectBundle } from "../../types/mod.ts";

export const APP_VERSION = "0.1.0";
export const BUNDLE_VERSION = 1;
export const DB_NAME = "intehrgrator";
export const DB_STORE = "projects";
export const DB_SAVES_STORE = "saves";
export const AUTOSAVE_STORAGE_KEY = "__autosave__";
export const MANUAL_SAVE_KEY_PREFIX = "manual:";
export const MAX_MANUAL_SAVES = 5;

export interface StoredProjectRecord {
  storageKey: string;
  kind: "autosave" | "manual";
  displayName: string;
  savedAt: string;
  bundle: ProjectBundle;
}

export interface LoadableProjectEntry {
  storageKey: string;
  kind: "autosave" | "manual";
  displayName: string;
  savedAt: string;
}

export function exportBundle(bundle: ProjectBundle): Uint8Array {
  const json = JSON.stringify(bundle, null, 2);
  const zipped = zipSync({ "project.json": strToU8(json) });
  return zipped;
}

export function importBundle(bytes: Uint8Array): ProjectBundle {
  const files = unzipSync(bytes);
  const projectBytes = files["project.json"];
  if (!projectBytes) throw new Error("Invalid .intehrgrator bundle: missing project.json");
  const bundle = JSON.parse(strFromU8(projectBytes)) as ProjectBundle;
  validateBundle(bundle);
  return bundle;
}

export function validateBundle(bundle: ProjectBundle): void {
  if (bundle.version !== BUNDLE_VERSION) {
    throw new Error(`Unsupported bundle version: ${bundle.version}`);
  }
  if (!bundle.mapping?.model) {
    throw new Error("Bundle missing mapping model");
  }
}

export async function saveToIndexedDb(bundle: ProjectBundle): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(bundle, bundle.projectId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadFromIndexedDb(projectId: string): Promise<ProjectBundle | null> {
  const db = await openDb();
  const result = await new Promise<ProjectBundle | undefined>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const req = tx.objectStore(DB_STORE).get(projectId);
    req.onsuccess = () => resolve(req.result as ProjectBundle | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result ?? null;
}

export async function listProjects(): Promise<ProjectBundle[]> {
  const db = await openDb();
  const result = await new Promise<ProjectBundle[]>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const req = tx.objectStore(DB_STORE).getAll();
    req.onsuccess = () => resolve((req.result ?? []) as ProjectBundle[]);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}

export async function saveAutosaveToIndexedDb(bundle: ProjectBundle): Promise<void> {
  const record: StoredProjectRecord = {
    storageKey: AUTOSAVE_STORAGE_KEY,
    kind: "autosave",
    displayName: "Autosave",
    savedAt: new Date().toISOString(),
    bundle,
  };
  await putStoredRecord(record);
}

export async function loadAutosaveFromIndexedDb(): Promise<StoredProjectRecord | null> {
  return await getStoredRecord(AUTOSAVE_STORAGE_KEY);
}

export async function saveManualSaveToIndexedDb(
  bundle: ProjectBundle,
  displayName: string,
): Promise<StoredProjectRecord> {
  const record: StoredProjectRecord = {
    storageKey: `${MANUAL_SAVE_KEY_PREFIX}${crypto.randomUUID()}`,
    kind: "manual",
    displayName: displayName.trim(),
    savedAt: new Date().toISOString(),
    bundle,
  };
  await putStoredRecord(record);
  await pruneManualSaves();
  return record;
}

export async function loadStoredProjectFromIndexedDb(
  storageKey: string,
): Promise<StoredProjectRecord | null> {
  return await getStoredRecord(storageKey);
}

export async function listLoadableProjects(): Promise<LoadableProjectEntry[]> {
  const records = await listStoredRecords();
  const autosave = records.find((r) => r.storageKey === AUTOSAVE_STORAGE_KEY);
  const manual = records
    .filter((r) => r.kind === "manual")
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
    .slice(0, MAX_MANUAL_SAVES);

  const entries: LoadableProjectEntry[] = [];
  if (autosave) {
    entries.push({
      storageKey: autosave.storageKey,
      kind: autosave.kind,
      displayName: autosave.displayName,
      savedAt: autosave.savedAt,
    });
  }
  for (const record of manual) {
    entries.push({
      storageKey: record.storageKey,
      kind: record.kind,
      displayName: record.displayName,
      savedAt: record.savedAt,
    });
  }
  return entries;
}

export function formatSaveTime(iso: string): string {
  const date = new Date(iso);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
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
    const req = tx.objectStore(DB_SAVES_STORE).get(storageKey);
    req.onsuccess = () => resolve(req.result as StoredProjectRecord | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result ?? null;
}

async function listStoredRecords(): Promise<StoredProjectRecord[]> {
  const db = await openDb();
  const result = await new Promise<StoredProjectRecord[]>((resolve, reject) => {
    const tx = db.transaction(DB_SAVES_STORE, "readonly");
    const req = tx.objectStore(DB_SAVES_STORE).getAll();
    req.onsuccess = () => resolve((req.result ?? []) as StoredProjectRecord[]);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}

async function pruneManualSaves(): Promise<void> {
  const records = (await listStoredRecords())
    .filter((r) => r.kind === "manual")
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  const stale = records.slice(MAX_MANUAL_SAVES);
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
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE);
      }
      if (!db.objectStoreNames.contains(DB_SAVES_STORE)) {
        db.createObjectStore(DB_SAVES_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function bundleFilename(projectId: string): string {
  return `${projectId}.intehrgrator`;
}

export function encodeBundleBase64(bundle: ProjectBundle): string {
  const zipped = exportBundle(bundle);
  let binary = "";
  for (const b of zipped) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function decodeBundleBase64(encoded: string): ProjectBundle {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return importBundle(bytes);
}

export function compressProjectJson(bundle: ProjectBundle): Uint8Array {
  return compressSync(strToU8(JSON.stringify(bundle)));
}

export function decompressProjectJson(bytes: Uint8Array): ProjectBundle {
  return JSON.parse(strFromU8(decompressSync(bytes))) as ProjectBundle;
}
