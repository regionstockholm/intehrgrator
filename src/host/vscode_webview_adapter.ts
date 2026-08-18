import type { ProjectBundle } from "../types/mod.ts";
import type {
  LoadableProjectEntry,
  StoredProjectRecord,
} from "../core/persistence/mod.ts";
import type {
  HostAdapter,
  PickedBinaryFile,
  PickedTextFile,
} from "./mod.ts";

interface VsCodeApi {
  postMessage(message: unknown): void;
}

interface HostResponse {
  type: "intehrgrator:host-response";
  id: string;
  result?: unknown;
  error?: string;
}

export class VsCodeWebviewHostAdapter implements HostAdapter {
  private readonly vscode: VsCodeApi;
  private readonly pending = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (reason: Error) => void;
  }>();

  constructor(vscodeApi: VsCodeApi = acquireVsCodeApi()) {
    this.vscode = vscodeApi;
    globalThis.addEventListener("message", (event: MessageEvent<HostResponse>) => {
      const message = event.data;
      if (message?.type !== "intehrgrator:host-response") return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error));
      else pending.resolve(message.result);
    });
  }

  async pickTextFile(accept?: string): Promise<PickedTextFile | null> {
    return await this.request("pickTextFile", { accept }) as PickedTextFile | null;
  }

  async pickBinaryFile(accept?: string): Promise<PickedBinaryFile | null> {
    const result = await this.request("pickBinaryFile", { accept }) as {
      name: string;
      bytes: number[];
    } | null;
    return result ? { name: result.name, bytes: Uint8Array.from(result.bytes) } : null;
  }

  async downloadText(filename: string, content: string, mime?: string): Promise<void> {
    await this.request("downloadText", { filename, content, mime });
  }

  async downloadBytes(filename: string, bytes: Uint8Array, mime?: string): Promise<void> {
    await this.request("downloadBytes", { filename, bytes: [...bytes], mime });
  }

  async copyToClipboard(text: string): Promise<void> {
    await this.request("copyToClipboard", { text });
  }

  async readClipboard(): Promise<string> {
    return await this.request("readClipboard") as string;
  }

  async saveAutosave(bundle: ProjectBundle): Promise<void> {
    await this.request("saveAutosave", { bundle });
  }

  async saveManualSave(bundle: ProjectBundle, displayName: string): Promise<void> {
    await this.request("saveManualSave", { bundle, displayName });
  }

  async loadStoredProjectRecord(storageKey: string): Promise<StoredProjectRecord | null> {
    return await this.request("loadStoredProjectRecord", { storageKey }) as StoredProjectRecord | null;
  }

  async listLoadableProjects(): Promise<LoadableProjectEntry[]> {
    return await this.request("listLoadableProjects") as LoadableProjectEntry[];
  }

  resolveAppUrl(path: string): string {
    return new URL(path.replace(/^\//, ""), location.href).href;
  }

  async fetchTextUrl(url: string): Promise<PickedTextFile> {
    return await this.request("fetchTextUrl", { url }) as PickedTextFile;
  }

  private request(command: string, payload: Record<string, unknown> = {}): Promise<unknown> {
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.vscode.postMessage({
        type: "intehrgrator:host-request",
        id,
        command,
        payload,
      });
    });
  }
}

declare function acquireVsCodeApi(): VsCodeApi;
