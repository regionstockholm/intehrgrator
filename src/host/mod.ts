import type { ProjectBundle } from "../types/mod.ts";
import type {
  LoadableProjectEntry,
  StoredProjectRecord,
} from "../core/persistence/mod.ts";

export interface PickedTextFile {
  name: string;
  text: string;
}

export interface PickedBinaryFile {
  name: string;
  bytes: Uint8Array;
}

/**
 * Host Abstraction shared by the Web Shell and VS Code/Cursor webview.
 * No DOM File, IndexedDB, or editor API types cross this seam.
 */
export interface HostAdapter {
  pickTextFile(accept?: string): Promise<PickedTextFile | null>;
  pickBinaryFile(accept?: string): Promise<PickedBinaryFile | null>;
  downloadText(filename: string, content: string, mime?: string): void | Promise<void>;
  downloadBytes(filename: string, bytes: Uint8Array, mime?: string): void | Promise<void>;
  copyToClipboard(text: string): Promise<void>;
  readClipboard(): Promise<string>;
  saveAutosave(bundle: ProjectBundle): Promise<void>;
  saveManualSave(bundle: ProjectBundle, displayName: string): Promise<void>;
  loadStoredProjectRecord(storageKey: string): Promise<StoredProjectRecord | null>;
  listLoadableProjects(): Promise<LoadableProjectEntry[]>;
  /** Resolve an app-relative documentation URL in the current host. */
  resolveAppUrl(path: string): string;
}

export { createHostAdapter } from "./create_host.ts";
export { WebHostAdapter } from "./web_adapter.ts";
export { VsCodeWebviewHostAdapter } from "./vscode_webview_adapter.ts";
