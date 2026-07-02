import * as esbuild from "npm:esbuild@0.25.0";
import { denoPlugins } from "jsr:@luca/esbuild-deno-loader@0.11.0";
import { copy, ensureDir } from "@std/fs";
import { dirname, fromFileUrl, join } from "@std/path";

const root = join(dirname(fromFileUrl(import.meta.url)), "..");
const outDir = join(root, "dist");
const configPath = join(root, "deno.json");

async function resolveBuildId(): Promise<string> {
  try {
    const { success, stdout } = await new Deno.Command("git", {
      args: ["rev-parse", "--short=7", "HEAD"],
      cwd: root,
      stdout: "piped",
      stderr: "null",
    }).output();
    if (success) {
      const hash = new TextDecoder().decode(stdout).trim();
      if (hash) return hash;
    }
  } catch {
    // git unavailable
  }
  return crypto.randomUUID().slice(0, 8);
}

const buildId = await resolveBuildId();
const buildTimestamp = new Date().toISOString();

await ensureDir(outDir);

await esbuild.build({
  absWorkingDir: root,
  plugins: [...denoPlugins({ configPath })],
  entryPoints: ["web/main.ts"],
  bundle: true,
  outfile: "dist/bundle.js",
  format: "esm",
  target: "es2022",
  platform: "browser",
  sourcemap: true,
  define: {
    "process.env.NODE_ENV": '"production"',
    "__BUILD_ID__": JSON.stringify(buildId),
    "__BUILD_TIMESTAMP__": JSON.stringify(buildTimestamp),
  },
});

await copy(join(root, "web", "index.html"), join(outDir, "index.html"), { overwrite: true });
await copy(join(root, "web", "styles.css"), join(outDir, "styles.css"), { overwrite: true });
await copy(join(root, "docs"), join(outDir, "docs"), { overwrite: true, recursive: true });

esbuild.stop();
console.log(`Built dist/ (${buildId} @ ${buildTimestamp})`);
