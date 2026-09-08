#!/usr/bin/env -S deno run -A
/**
 * CLI for GitHub Actions Pages deploy assembly.
 *
 *   deno run -A scripts/assemble-pages.ts main <root-dist> <out-dir>
 *   deno run -A scripts/assemble-pages.ts release <version-tag> <version-dist> <out-dir>
 */
import { dirname, fromFileUrl, join } from "@std/path";
import {
  assembleMainPagesSite,
  assembleReleasePagesSite,
  PAGES_SITE_URL,
} from "./pages_site.ts";

const root = join(dirname(fromFileUrl(import.meta.url)), "..");
const baseUrl = Deno.env.get("PAGES_SITE_URL") ?? PAGES_SITE_URL;

const [mode, ...rest] = Deno.args;
if (!mode || (mode !== "main" && mode !== "release")) {
  console.error("Usage: assemble-pages.ts main <root-dist> <out-dir>");
  console.error("       assemble-pages.ts release <version-tag> <version-dist> <out-dir>");
  Deno.exit(1);
}

if (mode === "main") {
  const [rootDist, outDir] = rest;
  if (!rootDist || !outDir) {
    console.error("Usage: assemble-pages.ts main <root-dist> <out-dir>");
    Deno.exit(1);
  }
  const manifest = await assembleMainPagesSite({
    baseUrl,
    rootDist: join(root, rootDist),
    outDir: join(root, outDir),
  });
  console.log(`Assembled main Pages site at ${outDir} (${manifest.versions.length} frozen versions)`);
} else {
  const [versionTag, versionDist, outDir] = rest;
  if (!versionTag || !versionDist || !outDir) {
    console.error("Usage: assemble-pages.ts release <version-tag> <version-dist> <out-dir>");
    Deno.exit(1);
  }
  const manifest = await assembleReleasePagesSite({
    baseUrl,
    versionTag,
    versionDist: join(root, versionDist),
    outDir: join(root, outDir),
  });
  console.log(
    `Assembled release Pages site at ${outDir} (added ${versionTag}; ${manifest.versions.length} total versions)`,
  );
}
