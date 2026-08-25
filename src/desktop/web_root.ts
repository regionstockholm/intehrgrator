import { join } from "@std/path";

/**
 * Workbench static files: copied next to this module for `deno desktop`
 * compile (`www/`), or the esbuild `dist/` during `deno task desktop`.
 */
export function resolveWebRoot(metaDirname: string): string {
  const candidates = [join(metaDirname, "www"), join(metaDirname, "..", "..", "dist")];
  for (const candidate of candidates) {
    try {
      const st = Deno.statSync(join(candidate, "index.html"));
      if (st.isFile) return candidate;
    } catch {
      // try next
    }
  }
  throw new Error(
    "Workbench assets not found (no index.html under www/ or dist/). Run `deno task build` first.",
  );
}
