/**
 * intEHRgrator desktop workbench.
 *
 * `deno desktop` already creates a hidden native window and reveals it after
 * the local HTTP server answers. Do not construct `Deno.BrowserWindow` at
 * startup — adopting that window before `Deno.serve()` leaves it hidden
 * forever on Windows (MainWindowHandle stays 0). Official pattern:
 * https://docs.deno.com/runtime/desktop/
 */
import { resolveWebRoot } from "./web_root.ts";
import { errorPageHandler, workbenchHandler } from "./serve.ts";
import { composeWorkbenchHandler } from "../agent/http.ts";

const USAGE = `intEHRgrator — local Integration Workbench

Serves the workbench on 127.0.0.1. \`deno desktop\` opens a native window;
\`deno run\` opens the default browser.

Options:
  --help, -h    Show this help
`;

function parseArgs(args: string[]): { help: boolean } {
  if (args.includes("-h") || args.includes("--help")) return { help: true };
  return { help: false };
}

async function openBrowser(url: string): Promise<void> {
  const cmd = Deno.build.os === "windows"
    ? new Deno.Command("cmd", { args: ["/c", "start", "", url] })
    : Deno.build.os === "darwin"
    ? new Deno.Command("open", { args: [url] })
    : new Deno.Command("xdg-open", { args: [url] });
  const child = cmd.spawn();
  await child.status;
}

export function workbenchOrErrorHandler(
  metaDirname: string | undefined,
  metaUrl: string,
  enableAgentApi = Deno.env.get("INTEHR_AGENT_API") !== "0",
): (req: Request) => Promise<Response> {
  try {
    const staticHandler = workbenchHandler(resolveWebRoot(metaDirname ?? ".", metaUrl));
    return composeWorkbenchHandler(staticHandler, enableAgentApi);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const errHandler = errorPageHandler(message);
    return (req: Request) => errHandler(req);
  }
}

if (import.meta.main) {
  const { help } = parseArgs(Deno.args);
  if (help) {
    console.log(USAGE);
    Deno.exit(0);
  }

  const handler = workbenchOrErrorHandler(import.meta.dirname, import.meta.url);
  const desktopAddr = Deno.env.get("DENO_SERVE_ADDRESS");
  if (desktopAddr) {
    // Bind the port the webview already plans to open. Passing hostname/port
    // here can desync the server from the hidden startup window.
    Deno.serve(handler);
  } else {
    Deno.serve({
      hostname: "127.0.0.1",
      port: Number(Deno.env.get("PORT") ?? 0),
      onListen({ hostname, port }) {
        const url = `http://${hostname}:${port}/`;
        console.log(`intEHRgrator ${url}`);
        void openBrowser(url);
      },
    }, handler);
  }
}
