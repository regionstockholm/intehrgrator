import type { HostAdapter } from "./mod.ts";
import { WebHostAdapter } from "./web_adapter.ts";
import { VsCodeWebviewHostAdapter } from "./vscode_webview_adapter.ts";

export function createHostAdapter(): HostAdapter {
  const candidate = globalThis as typeof globalThis & {
    acquireVsCodeApi?: () => { postMessage(message: unknown): void };
  };
  return typeof candidate.acquireVsCodeApi === "function"
    ? new VsCodeWebviewHostAdapter(candidate.acquireVsCodeApi())
    : new WebHostAdapter();
}
