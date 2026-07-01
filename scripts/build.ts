import * as esbuild from "npm:esbuild@0.25.0";
import { denoPlugins } from "jsr:@luca/esbuild-deno-loader@0.11.0";
import { copy, ensureDir } from "@std/fs";
import { dirname, fromFileUrl, join } from "@std/path";

const root = join(dirname(fromFileUrl(import.meta.url)), "..");
const outDir = join(root, "dist");
const configPath = join(root, "deno.json");

await ensureDir(outDir);

await esbuild.build({
  plugins: [...denoPlugins({ configPath })],
  entryPoints: [join(root, "web", "main.ts")],
  bundle: true,
  outfile: join(outDir, "bundle.js"),
  format: "esm",
  target: "es2022",
  platform: "browser",
  sourcemap: true,
  define: { "process.env.NODE_ENV": '"production"' },
});

await copy(join(root, "web", "index.html"), join(outDir, "index.html"), { overwrite: true });
await copy(join(root, "web", "styles.css"), join(outDir, "styles.css"), { overwrite: true });
await copy(join(root, "docs"), join(outDir, "docs"), { overwrite: true, recursive: true });

esbuild.stop();
console.log("Built dist/");
