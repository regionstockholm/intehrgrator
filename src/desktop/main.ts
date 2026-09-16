/**
 * intEHRgrator desktop workbench.
 *
 * `deno desktop` already creates a hidden native window and reveals it after
 * the local HTTP server answers. Do not construct `Deno.BrowserWindow` at
 * startup — adopting that window before `Deno.serve()` leaves it hidden
 * forever on Windows (MainWindowHandle stays 0). Official pattern:
 * https://docs.deno.com/runtime/desktop/
 *
 * `--headless` is the exception: adopt the startup window after serve and hide
 * it so the Agent API keeps running without a workbench UI.
 */
import { resolveWebRoot } from "./web_root.ts";
import { errorPageHandler, workbenchHandler } from "./serve.ts";
import { composeWorkbenchHandler, getSharedWorkbenchService } from "../agent/http.ts";
import {
  bindRequiresTokenMessage,
  parseDesktopArgs,
  USAGE,
  type DesktopCliOptions,
} from "./cli.ts";

async function openBrowser(url: string): Promise<void> {
  const cmd = Deno.build.os === "windows"
    ? new Deno.Command("cmd", { args: ["/c", "start", "", url] })
    : Deno.build.os === "darwin"
    ? new Deno.Command("open", { args: [url] })
    : new Deno.Command("xdg-open", { args: [url] });
  const child = cmd.spawn();
  await child.status;
}

export function shouldOpenUi(opts: DesktopCliOptions): boolean {
  return !opts.headless;
}

type BrowserWindowHandle = {
  hide?: () => void;
};

type DenoDesktop = typeof Deno & {
  BrowserWindow?: new (options: Record<string, unknown>) => BrowserWindowHandle;
};

/** Adopt the Deno desktop startup window and hide it (`--headless`). */
export function hideDesktopWindow(): void {
  const Ctor = (Deno as DenoDesktop).BrowserWindow;
  if (!Ctor) return;
  try {
    const win = new Ctor({ url: "about:blank", noActivate: true, visible: false });
    win.hide?.();
  } catch {
    try {
      const win = new Ctor({ url: "about:blank", noActivate: true });
      win.hide?.();
    } catch {
      // `deno run` has no native window.
    }
  }
}

export function workbenchOrErrorHandler(
  metaDirname: string | undefined,
  metaUrl: string,
  enableAgentApi = Deno.env.get("INTEHR_AGENT_API") !== "0",
  token?: string,
): (req: Request) => Promise<Response> {
  try {
    const staticHandler = workbenchHandler(resolveWebRoot(metaDirname ?? ".", metaUrl));
    return composeWorkbenchHandler(staticHandler, enableAgentApi, { token });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const errHandler = errorPageHandler(message);
    return (req: Request) => errHandler(req);
  }
}

function envMap(): Record<string, string | undefined> {
  return {
    PORT: Deno.env.get("PORT"),
    INTEHR_BIND: Deno.env.get("INTEHR_BIND"),
    INTEHR_AGENT_TOKEN: Deno.env.get("INTEHR_AGENT_TOKEN"),
  };
}

if (import.meta.main) {
  let opts: DesktopCliOptions;
  try {
    opts = parseDesktopArgs(Deno.args, envMap());
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    Deno.exit(1);
  }
  if (opts.help) {
    console.log(USAGE);
    Deno.exit(0);
  }
  const tokenErr = bindRequiresTokenMessage(opts);
  if (tokenErr) {
    console.error(tokenErr);
    Deno.exit(1);
  }
  if (opts.token) Deno.env.set("INTEHR_AGENT_TOKEN", opts.token);

  if (opts.load) {
    const bytes = await Deno.readFile(opts.load);
    getSharedWorkbenchService().loadBundleFile(bytes);
  }

  const handler = workbenchOrErrorHandler(
    import.meta.dirname,
    import.meta.url,
    Deno.env.get("INTEHR_AGENT_API") !== "0",
    opts.token,
  );
  const desktopAddr = Deno.env.get("DENO_SERVE_ADDRESS");
  if (desktopAddr) {
    // Bind the port the webview already plans to open. Passing hostname/port
    // here can desync the server from the hidden startup window.
    Deno.serve(handler);
    if (opts.headless) hideDesktopWindow();
  } else {
    Deno.serve({
      hostname: opts.bind,
      port: opts.port,
      onListen({ hostname, port }) {
        const url = `http://${hostname}:${port}/`;
        console.log(`intEHRgrator ${url}${opts.headless ? " (headless)" : ""}`);
        if (shouldOpenUi(opts)) void openBrowser(url);
      },
    }, handler);
  }
}
