/**
 * intEHRgrator desktop workbench: local HTTP + native window (`deno desktop`)
 * or the system browser (`deno run`).
 */
import { resolveWebRoot } from "./web_root.ts";
import { workbenchHandler } from "./serve.ts";

const USAGE = `intEHRgrator — local Integration Workbench

Serves the workbench on 127.0.0.1 and opens a native window when built
with \`deno desktop\`. \`deno run\` opens the default browser instead.

Options:
  --help, -h    Show this help
`;

interface BrowserWindowLike {
  navigate(url: string): void;
}

type BrowserWindowCtor = new (options?: {
  title?: string;
  width?: number;
  height?: number;
}) => BrowserWindowLike;

function browserWindowCtor(): BrowserWindowCtor | undefined {
  return (Deno as unknown as { BrowserWindow?: BrowserWindowCtor }).BrowserWindow;
}

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

if (import.meta.main) {
  const { help } = parseArgs(Deno.args);
  if (help) {
    console.log(USAGE);
    Deno.exit(0);
  }

  const webRoot = resolveWebRoot(import.meta.dirname!);
  const handler = workbenchHandler(webRoot);
  const Window = browserWindowCtor();
  if (Window) {
    new Window({ title: "intEHRgrator", width: 1440, height: 900 });
  }

  Deno.serve({
    hostname: "127.0.0.1",
    port: Number(Deno.env.get("PORT") ?? 0),
    onListen({ hostname, port }) {
      const url = `http://${hostname}:${port}/`;
      console.log(`intEHRgrator ${url}`);
      if (!Window) {
        void openBrowser(url);
      }
    },
  }, handler);
}
