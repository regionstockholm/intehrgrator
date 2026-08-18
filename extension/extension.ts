import * as vscode from "vscode";

const VIEW_TYPE = "intehrgrator.workbench";
const SAVES_KEY = "intehrgrator.saves";

interface HostRequest {
  type: "intehrgrator:host-request";
  id: string;
  command: string;
  payload?: Record<string, unknown>;
}

interface StoredRecord {
  storageKey: string;
  kind: "autosave" | "manual";
  displayName: string;
  savedAt: string;
  bundle: unknown;
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("intehrgrator.openWorkbench", async () => {
      const panel = vscode.window.createWebviewPanel(
        VIEW_TYPE,
        "intEHRgrator",
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "dist")],
        },
      );
      panel.webview.html = await webviewHtml(context, panel.webview);
      panel.webview.onDidReceiveMessage(
        (message: HostRequest) => void handleHostRequest(context, panel.webview, message),
        undefined,
        context.subscriptions,
      );
    }),
  );
}

export function deactivate(): void {
  // no-op
}

async function handleHostRequest(
  context: vscode.ExtensionContext,
  webview: vscode.Webview,
  request: HostRequest,
): Promise<void> {
  if (request?.type !== "intehrgrator:host-request") return;
  try {
    const result = await dispatchHostCommand(context, request.command, request.payload ?? {});
    await webview.postMessage({
      type: "intehrgrator:host-response",
      id: request.id,
      result,
    });
  } catch (error) {
    await webview.postMessage({
      type: "intehrgrator:host-response",
      id: request.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function dispatchHostCommand(
  context: vscode.ExtensionContext,
  command: string,
  payload: Record<string, unknown>,
): Promise<unknown> {
  switch (command) {
    case "pickTextFile": {
      const uri = await pickFile();
      if (!uri) return null;
      return {
        name: uri.path.split("/").pop() ?? "input",
        text: new TextDecoder().decode(await vscode.workspace.fs.readFile(uri)),
      };
    }
    case "pickBinaryFile": {
      const uri = await pickFile();
      if (!uri) return null;
      return {
        name: uri.path.split("/").pop() ?? "input",
        bytes: [...await vscode.workspace.fs.readFile(uri)],
      };
    }
    case "downloadText":
      await writeDownload(
        String(payload.filename ?? "output.txt"),
        new TextEncoder().encode(String(payload.content ?? "")),
      );
      return null;
    case "downloadBytes":
      await writeDownload(
        String(payload.filename ?? "output.bin"),
        Uint8Array.from(payload.bytes as number[] ?? []),
      );
      return null;
    case "copyToClipboard":
      await vscode.env.clipboard.writeText(String(payload.text ?? ""));
      return null;
    case "readClipboard":
      return await vscode.env.clipboard.readText();
    case "saveAutosave":
      await putRecord(context, {
        storageKey: "__autosave__",
        kind: "autosave",
        displayName: "Autosave",
        savedAt: new Date().toISOString(),
        bundle: payload.bundle,
      });
      return null;
    case "saveManualSave": {
      const record: StoredRecord = {
        storageKey: `manual:${crypto.randomUUID()}`,
        kind: "manual",
        displayName: String(payload.displayName ?? "Saved project"),
        savedAt: new Date().toISOString(),
        bundle: payload.bundle,
      };
      await putRecord(context, record);
      return null;
    }
    case "loadStoredProjectRecord":
      return records(context).find((record) => record.storageKey === payload.storageKey) ?? null;
    case "listLoadableProjects":
      return records(context)
        .sort((left, right) => {
          if (left.kind !== right.kind) return left.kind === "autosave" ? -1 : 1;
          return right.savedAt.localeCompare(left.savedAt);
        })
        .slice(0, 6)
        .map(({ storageKey, kind, displayName, savedAt }) => ({
          storageKey,
          kind,
          displayName,
          savedAt,
        }));
    default:
      throw new Error(`Unsupported host command: ${command}`);
  }
}

async function pickFile(): Promise<vscode.Uri | null> {
  const picked = await vscode.window.showOpenDialog({ canSelectMany: false });
  return picked?.[0] ?? null;
}

async function writeDownload(filename: string, bytes: Uint8Array): Promise<void> {
  const target = await vscode.window.showSaveDialog({ defaultUri: defaultSaveUri(filename) });
  if (target) await vscode.workspace.fs.writeFile(target, bytes);
}

function defaultSaveUri(filename: string): vscode.Uri | undefined {
  const folder = vscode.workspace.workspaceFolders?.[0]?.uri;
  return folder ? vscode.Uri.joinPath(folder, filename) : undefined;
}

function records(context: vscode.ExtensionContext): StoredRecord[] {
  return context.workspaceState.get<StoredRecord[]>(SAVES_KEY, []);
}

async function putRecord(
  context: vscode.ExtensionContext,
  record: StoredRecord,
): Promise<void> {
  const next = records(context).filter((item) => item.storageKey !== record.storageKey);
  next.push(record);
  const autosaves = next.filter((item) => item.kind === "autosave");
  const manual = next
    .filter((item) => item.kind === "manual")
    .sort((left, right) => right.savedAt.localeCompare(left.savedAt))
    .slice(0, 5);
  await context.workspaceState.update(SAVES_KEY, [...autosaves, ...manual]);
}

async function webviewHtml(
  context: vscode.ExtensionContext,
  webview: vscode.Webview,
): Promise<string> {
  const dist = vscode.Uri.joinPath(context.extensionUri, "dist");
  const htmlBytes = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(dist, "index.html"));
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(dist, "styles.css"));
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(dist, "bundle.js"));
  const csp = [
    "default-src 'none'",
    `style-src ${webview.cspSource} https://fonts.googleapis.com`,
    `font-src ${webview.cspSource} https://fonts.gstatic.com`,
    `img-src ${webview.cspSource} data:`,
    `script-src ${webview.cspSource}`,
  ].join("; ");
  return new TextDecoder().decode(htmlBytes)
    .replace("</head>", `<meta http-equiv="Content-Security-Policy" content="${csp}"></head>`)
    .replace('href="styles.css"', `href="${styleUri}"`)
    .replace('src="./bundle.js"', `src="${scriptUri}"`);
}
