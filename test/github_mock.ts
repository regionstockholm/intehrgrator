import { join } from "@std/path";

const CLINICAL_MODEL_FILE = /\.(adl|adls|opt|oet|t\.json)$/i;

/** Mock GitHub API + raw.githubusercontent.com for a single-branch repository tree. */
export function mockGithubFetch(files: Record<string, string>): typeof fetch {
  return async (input) => {
    const url = String(input);
    if (url.includes("/repos/") && url.includes("/branches/")) {
      return jsonResponse({ commit: { sha: "deadbeef" } });
    }
    if (url.includes("/git/trees/")) {
      return jsonResponse({
        tree: Object.keys(files).map((path) => ({ path, type: "blob" })),
      });
    }
    const raw = url.match(/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\/(.+)$/);
    if (raw) {
      const path = decodeURIComponent(raw[1]!);
      const content = files[path];
      if (content == null) return new Response("missing", { status: 404 });
      return new Response(content, { status: 200 });
    }
    return new Response(`unhandled ${url}`, { status: 500 });
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Load vendored Ehrlibs clinical-model files keyed by repo-relative path. */
export async function readVendoredClinicalModelFiles(
  root = join(import.meta.dirname!, "..", "vendor", "openEHR-model-examples"),
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  async function walk(dir: string, rel: string): Promise<void> {
    for await (const entry of Deno.readDir(dir)) {
      if (entry.name.startsWith(".")) continue;
      const nextRel = rel ? `${rel}/${entry.name}` : entry.name;
      const nextAbs = join(dir, entry.name);
      if (entry.isDirectory) {
        await walk(nextAbs, nextRel);
        continue;
      }
      if (!CLINICAL_MODEL_FILE.test(entry.name)) continue;
      files[nextRel] = await Deno.readTextFile(nextAbs);
    }
  }
  await walk(root, "");
  return files;
}
