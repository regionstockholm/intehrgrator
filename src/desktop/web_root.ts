import { fromFileUrl, join } from "@std/path";

/**
 * Workbench static files: copied next to this module for `deno desktop`
 * compile (`www/`), or the esbuild `dist/` during `deno task desktop`.
 *
 * Tries `import.meta.url` first so Windows backslashes from `join()` cannot
 * miss the compiled VFS / extracted files.
 */
export function resolveWebRoot(metaDirname: string, metaUrl?: string): string {
  const candidates: string[] = [];
  if (metaUrl) {
    for (const rel of ["./www/", "../../dist/"]) {
      try {
        candidates.push(fromFileUrl(new URL(rel, metaUrl)));
      } catch {
        // import.meta.url is not a file: URL in some hosts
      }
    }
  }
  const posix = metaDirname.replaceAll("\\", "/");
  candidates.push(`${posix}/www`, join(metaDirname, "www"), join(metaDirname, "..", "..", "dist"));

  const seen = new Set<string>();
  for (const dir of candidates) {
    const normalized = dir.replace(/[/\\]+$/, "");
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    for (const index of [join(normalized, "index.html"), `${normalized.replaceAll("\\", "/")}/index.html`]) {
      try {
        const st = Deno.statSync(index);
        if (st.isFile) return normalized;
      } catch {
        // try next spelling
      }
    }
  }
  throw new Error(
    "Workbench assets not found (no index.html under www/ or dist/). Run `deno task build` first.",
  );
}
