/**
 * Build Web Shell, serve dist/, run Playwright UI tests, tear down.
 *
 * Env:
 *   UI_TEST_PORT — default 5173
 *   UI_TEST_SKIP_BUILD — set to "1" to reuse existing dist/
 *   PW_DISABLE_TS_ESM — forced to "1" for Deno + Playwright
 */

import { dirname, fromFileUrl, join } from "@std/path";

const root = join(dirname(fromFileUrl(import.meta.url)), "..");
const port = Number(Deno.env.get("UI_TEST_PORT") ?? 5173);
const baseUrl = `http://127.0.0.1:${port}`;

Deno.env.set("PW_DISABLE_TS_ESM", "1");
Deno.env.set("UI_TEST_BASE_URL", baseUrl);

async function run(cmd: string[], opts: { cwd?: string; env?: Record<string, string> } = {}) {
  const proc = new Deno.Command(cmd[0]!, {
    args: cmd.slice(1),
    cwd: opts.cwd ?? root,
    env: { ...Deno.env.toObject(), ...opts.env },
    stdout: "inherit",
    stderr: "inherit",
  });
  const status = await proc.output();
  if (!status.success) {
    throw new Error(`Command failed (${status.code}): ${cmd.join(" ")}`);
  }
}

if (Deno.env.get("UI_TEST_SKIP_BUILD") !== "1") {
  console.log("→ deno task build");
  await run(["deno", "task", "build"]);
}

const server = new Deno.Command("deno", {
  args: ["run", "-A", "scripts/dev-server.ts"],
  cwd: root,
  env: { ...Deno.env.toObject(), PORT: String(port) },
  stdout: "piped",
  stderr: "piped",
}).spawn();

async function waitForServer(url: string, attempts = 40): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      await res.arrayBuffer();
      if (res.ok || res.status === 404) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Server did not become ready at ${url}`);
}

let exitCode = 1;
try {
  console.log(`→ waiting for ${baseUrl}`);
  await waitForServer(baseUrl);

  // Ensure Chromium is available. Prefer npx — Deno's `npm:playwright install`
  // has hung on browser extraction in some environments.
  console.log("→ playwright install chromium (if needed)");
  try {
    await run(["npx", "--yes", "playwright@1.51.0", "install", "chromium"]);
  } catch (err) {
    console.warn("playwright install warning:", err);
  }

  console.log("→ deno test test/ui");
  await run(["deno", "test", "-A", "--no-check", "test/ui"], {
    env: {
      PW_DISABLE_TS_ESM: "1",
      UI_TEST_BASE_URL: baseUrl,
    },
  });
  exitCode = 0;
} catch (err) {
  console.error(err);
  exitCode = 1;
} finally {
  try {
    server.kill("SIGTERM");
  } catch {
    // already exited
  }
  await server.status;
}

Deno.exit(exitCode);
