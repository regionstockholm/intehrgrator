/**
 * Headless HostAdapter: fetch URLs, no GUI pickers. Writes are no-ops;
 * Agent API export tools write paths themselves.
 */

import type { ProjectBundle } from "../types/mod.ts";
import type {
  HostAdapter,
  PickedBinaryFile,
  PickedTextFile,
} from "./mod.ts";
import type { FilePickerKind } from "./file_picker.ts";
import type { LoadableProjectEntry, StoredProjectRecord } from "../core/persistence/mod.ts";
import { assertHttpUrl, filenameFromUrl, toFetchableUrl } from "./fetch_url.ts";

const DOCS_BLOB = "https://github.com/regionstockholm/intehrgrator/blob/main/";

export class FsHostAdapter implements HostAdapter {
  constructor(private readonly docsBase = DOCS_BLOB) {}

  pickTextFile(_accept?: string, _kind?: FilePickerKind): Promise<PickedTextFile | null> {
    return Promise.resolve(null);
  }

  pickTextFilesFromDirectory(
    _accept?: string,
    _kind?: FilePickerKind,
  ): Promise<PickedTextFile[] | null> {
    return Promise.resolve(null);
  }

  pickBinaryFile(_accept?: string, _kind?: FilePickerKind): Promise<PickedBinaryFile | null> {
    return Promise.resolve(null);
  }

  downloadText(_filename: string, _content: string, _mime?: string): void {}
  downloadBytes(_filename: string, _bytes: Uint8Array, _mime?: string): void {}
  copyToClipboard(_text: string): Promise<void> {
    return Promise.resolve();
  }
  readClipboard(): Promise<string> {
    return Promise.resolve("");
  }
  saveAutosave(_bundle: ProjectBundle): Promise<void> {
    return Promise.resolve();
  }
  saveManualSave(_bundle: ProjectBundle, _displayName: string): Promise<void> {
    return Promise.resolve();
  }
  loadStoredProjectRecord(_storageKey: string): Promise<StoredProjectRecord | null> {
    return Promise.resolve(null);
  }
  listLoadableProjects(): Promise<LoadableProjectEntry[]> {
    return Promise.resolve([]);
  }

  resolveAppUrl(path: string): string {
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    return `${this.docsBase}${path.replace(/^\.\//, "")}`;
  }

  async fetchTextUrl(url: string): Promise<PickedTextFile> {
    const fetchable = toFetchableUrl(url);
    assertHttpUrl(fetchable);
    const response = await fetch(fetchable);
    if (!response.ok) {
      throw new Error(`Could not load ${fetchable} (${response.status} ${response.statusText})`);
    }
    return { name: filenameFromUrl(fetchable), text: await response.text() };
  }
}

export function createFsHostAdapter(): HostAdapter {
  return new FsHostAdapter();
}
