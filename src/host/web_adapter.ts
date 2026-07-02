import type { ProjectBundle } from "@intehrgrator/types/mod.ts";
import type { LoadableProjectEntry, StoredProjectRecord } from "@intehrgrator/core/persistence/mod.ts";

export interface HostAdapter {
  pickFile(accept?: string): Promise<File | null>;
  readTextFile(file: File): Promise<string>;
  downloadText(filename: string, content: string, mime?: string): void;
  downloadBytes(filename: string, bytes: Uint8Array, mime?: string): void;
  copyToClipboard(text: string): Promise<void>;
  readClipboard(): Promise<string>;
  saveProject(bundle: ProjectBundle): Promise<void>;
  loadProject(projectId: string): Promise<ProjectBundle | null>;
  listProjects(): Promise<ProjectBundle[]>;
  saveAutosave(bundle: ProjectBundle): Promise<void>;
  saveManualSave(bundle: ProjectBundle, displayName: string): Promise<void>;
  loadStoredProject(storageKey: string): Promise<ProjectBundle | null>;
  loadStoredProjectRecord(storageKey: string): Promise<StoredProjectRecord | null>;
  listLoadableProjects(): Promise<LoadableProjectEntry[]>;
}

export class WebHostAdapter implements HostAdapter {
  async pickFile(accept?: string): Promise<File | null> {
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

  async readTextFile(file: File): Promise<string> {
    return await file.text();
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
    const blob = new Blob([bytes], { type: mime });
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

  async saveProject(bundle: ProjectBundle): Promise<void> {
    const { saveToIndexedDb } = await import("@intehrgrator/core/persistence/mod.ts");
    await saveToIndexedDb(bundle);
  }

  async loadProject(projectId: string): Promise<ProjectBundle | null> {
    const { loadFromIndexedDb } = await import("@intehrgrator/core/persistence/mod.ts");
    return await loadFromIndexedDb(projectId);
  }

  async listProjects(): Promise<ProjectBundle[]> {
    const { listProjects } = await import("@intehrgrator/core/persistence/mod.ts");
    return await listProjects();
  }

  async saveAutosave(bundle: ProjectBundle): Promise<void> {
    const { saveAutosaveToIndexedDb } = await import("@intehrgrator/core/persistence/mod.ts");
    await saveAutosaveToIndexedDb(bundle);
  }

  async saveManualSave(bundle: ProjectBundle, displayName: string): Promise<void> {
    const { saveManualSaveToIndexedDb } = await import("@intehrgrator/core/persistence/mod.ts");
    await saveManualSaveToIndexedDb(bundle, displayName);
  }

  async loadStoredProject(storageKey: string): Promise<ProjectBundle | null> {
    const record = await this.loadStoredProjectRecord(storageKey);
    return record?.bundle ?? null;
  }

  async loadStoredProjectRecord(storageKey: string): Promise<StoredProjectRecord | null> {
    const { loadStoredProjectFromIndexedDb } = await import("@intehrgrator/core/persistence/mod.ts");
    return await loadStoredProjectFromIndexedDb(storageKey);
  }

  async listLoadableProjects(): Promise<LoadableProjectEntry[]> {
    const { listLoadableProjects } = await import("@intehrgrator/core/persistence/mod.ts");
    return await listLoadableProjects();
  }
}
