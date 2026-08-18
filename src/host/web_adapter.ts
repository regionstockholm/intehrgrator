import type { ProjectBundle } from "@intehrgrator/types/mod.ts";
import type { FilePickerKind, HostAdapter, PickedBinaryFile, PickedTextFile } from "./mod.ts";
import type { LoadableProjectEntry, StoredProjectRecord } from "@intehrgrator/core/persistence/mod.ts";
import { assertHttpUrl, filenameFromUrl, toFetchableUrl } from "./fetch_url.ts";
import { acceptToPickerTypes, filePickerId } from "./file_picker.ts";
import {
  listLoadableProjects,
  loadStoredProjectRecord,
  saveAutosave,
  saveManualSave,
} from "./web_storage.ts";

export class WebHostAdapter implements HostAdapter {
  async pickTextFile(accept?: string, kind?: FilePickerKind): Promise<PickedTextFile | null> {
    const file = await this.pickDomFile(accept, kind);
    return file ? { name: file.name, text: await file.text() } : null;
  }

  async pickBinaryFile(accept?: string, kind?: FilePickerKind): Promise<PickedBinaryFile | null> {
    const file = await this.pickDomFile(accept, kind);
    return file
      ? { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }
      : null;
  }

  private async pickDomFile(accept?: string, kind?: FilePickerKind): Promise<File | null> {
    const fromFsAccess = await this.pickWithFileSystemAccess(accept, kind);
    if (fromFsAccess !== undefined) return fromFsAccess;
    return await this.pickWithInputElement(accept);
  }

  /**
   * Chromium File System Access API remembers the last folder per `id`.
   * Returns undefined when the API is unavailable so the input fallback can run.
   */
  private async pickWithFileSystemAccess(
    accept?: string,
    kind?: FilePickerKind,
  ): Promise<File | null | undefined> {
    const showOpenFilePicker = (
      globalThis as typeof globalThis & {
        showOpenFilePicker?: (options: {
          multiple?: boolean;
          id?: string;
          types?: Array<{ description?: string; accept: Record<string, string[]> }>;
        }) => Promise<FileSystemFileHandle[]>;
      }
    ).showOpenFilePicker;
    if (typeof showOpenFilePicker !== "function") return undefined;

    try {
      const [handle] = await showOpenFilePicker({
        multiple: false,
        id: filePickerId(kind),
        types: acceptToPickerTypes(accept),
      });
      return handle ? await handle.getFile() : null;
    } catch (err) {
      if (isAbortError(err)) return null;
      throw err;
    }
  }

  private async pickWithInputElement(accept?: string): Promise<File | null> {
    return await new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.style.position = "fixed";
      input.style.left = "-9999px";
      if (accept) input.accept = accept;

      let settled = false;
      const finish = (file: File | null) => {
        if (settled) return;
        settled = true;
        input.remove();
        resolve(file);
      };

      input.addEventListener("change", () => finish(input.files?.[0] ?? null));
      input.addEventListener("cancel", () => finish(null));

      document.body.appendChild(input);
      input.click();

      // Browsers without `cancel` on <input type="file"> — resolve when dialog closes with no selection.
      globalThis.addEventListener("focus", function onWindowFocus() {
        setTimeout(() => {
          globalThis.removeEventListener("focus", onWindowFocus);
          if (!settled && !input.files?.length) finish(null);
        }, 400);
      }, { once: true });
    });
  }

  downloadText(filename: string, content: string, mime = "text/plain"): void {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  downloadBytes(filename: string, bytes: Uint8Array, mime = "application/octet-stream"): void {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const blob = new Blob([copy.buffer], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async copyToClipboard(text: string): Promise<void> {
    await navigator.clipboard.writeText(text);
  }

  async readClipboard(): Promise<string> {
    return await navigator.clipboard.readText();
  }

  async saveAutosave(bundle: ProjectBundle): Promise<void> {
    await saveAutosave(bundle);
  }

  async saveManualSave(bundle: ProjectBundle, displayName: string): Promise<void> {
    await saveManualSave(bundle, displayName);
  }

  async loadStoredProjectRecord(storageKey: string): Promise<StoredProjectRecord | null> {
    return await loadStoredProjectRecord(storageKey);
  }

  async listLoadableProjects(): Promise<LoadableProjectEntry[]> {
    return await listLoadableProjects();
  }

  resolveAppUrl(path: string): string {
    return new URL(path, location.href).href;
  }

  async fetchTextUrl(url: string): Promise<PickedTextFile> {
    const fetchable = toFetchableUrl(url, location.href);
    assertHttpUrl(fetchable);
    const response = await fetch(fetchable);
    if (!response.ok) {
      throw new Error(`Could not load ${fetchable} (${response.status} ${response.statusText})`);
    }
    return { name: filenameFromUrl(fetchable), text: await response.text() };
  }
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}
