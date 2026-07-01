import { compressSync, decompressSync, strToU8, strFromU8, zipSync, unzipSync } from "fflate";
import type { ProjectBundle } from "../../types/mod.ts";

export const APP_VERSION = "0.1.0";
export const BUNDLE_VERSION = 1;
export const DB_NAME = "intehrgrator";
export const DB_STORE = "projects";

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

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(DB_STORE);
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
