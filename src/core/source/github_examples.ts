/**
 * Bulk-load JSON/XML example instances from a folder in a public GitHub repository.
 * Uses the same git-trees API pattern as ehrtslib's clinical-model loader.
 */

import { parseGitHubRepoSpec, type GitHubRepoRef } from "ehrtslib/parser/mod.ts";
import type { PickedTextFile } from "../../host/mod.ts";

const EXAMPLE_FILE = /\.(json|xml)$/i;

export const DEFAULT_GITHUB_EXAMPLES_URL =
  "https://github.com/Ehrlibs/openEHR-model-examples/tree/main/local/theme-packs/sport-event-details/instances";

export interface GitHubExamplesLoadOptions {
  fetch?: typeof fetch;
  githubToken?: string;
  maxFiles?: number;
}

export interface GitHubExamplesLoadResult {
  files: PickedTextFile[];
  warnings: string[];
  fetched: number;
  skipped: number;
}

/** GitHub `tree` URL or `owner/repo@branch:path` spec pointing at a directory. */
export function parseGitHubExamplesDirectoryUrl(input: string): GitHubRepoRef {
  const trimmed = input.trim();
  const treeWithPath = trimmed.match(
    /github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+?)(?:[?#].*)?$/i,
  );
  if (treeWithPath) {
    return {
      owner: treeWithPath[1]!,
      repo: treeWithPath[2]!.replace(/\.git$/, ""),
      ref: decodeURIComponent(treeWithPath[3]!),
      pathPrefix: decodeURIComponent(treeWithPath[4]!).replace(/\/$/, ""),
    };
  }
  const treeRoot = trimmed.match(
    /github\.com\/([^/]+)\/([^/]+)\/tree\/([^/?#]+)/i,
  );
  if (treeRoot) {
    return {
      owner: treeRoot[1]!,
      repo: treeRoot[2]!.replace(/\.git$/, ""),
      ref: decodeURIComponent(treeRoot[3]!),
      pathPrefix: "",
    };
  }
  return parseGitHubRepoSpec(trimmed);
}

export function isGitHubExamplesDirectoryUrl(input: string): boolean {
  try {
    parseGitHubExamplesDirectoryUrl(input);
    return /github\.com\/[^/]+\/[^/]+\/tree\//i.test(input.trim()) ||
      /^[^/]+\/[^/@]+(?:@[^:]+)?(?::[^/]+)?$/i.test(input.trim());
  } catch {
    return false;
  }
}

export async function loadGitHubExampleDirectory(
  sourceUrl: string,
  options?: GitHubExamplesLoadOptions,
): Promise<GitHubExamplesLoadResult> {
  const ref = parseGitHubExamplesDirectoryUrl(sourceUrl);
  const fetchFn = options?.fetch ?? globalThis.fetch;
  const token = options?.githubToken ??
    (typeof Deno !== "undefined" ? Deno.env.get("GITHUB_TOKEN") : undefined);
  const headers = githubApiHeaders(token);
  const branch = ref.ref ?? "master";
  const warnings: string[] = [];
  const prefix = ref.pathPrefix?.replace(/^\/+/, "").replace(/\/$/, "");

  const branchRes = await fetchFn(
    `https://api.github.com/repos/${ref.owner}/${ref.repo}/branches/${encodeURIComponent(branch)}`,
    { headers },
  );
  if (!branchRes.ok) {
    throw new Error(
      `GitHub branch ${ref.owner}/${ref.repo}@${branch}: ${branchRes.status} ${branchRes.statusText}`,
    );
  }
  const branchJson = await branchRes.json() as { commit?: { sha?: string } };
  const treeSha = branchJson.commit?.sha;
  if (!treeSha) throw new Error("Could not resolve branch commit SHA");

  const treeRes = await fetchFn(
    `https://api.github.com/repos/${ref.owner}/${ref.repo}/git/trees/${treeSha}?recursive=1`,
    { headers },
  );
  if (!treeRes.ok) {
    throw new Error(`GitHub tree API: ${treeRes.status} ${treeRes.statusText}`);
  }
  const treeJson = await treeRes.json() as {
    tree?: Array<{ path?: string; type?: string }>;
  };

  const paths: string[] = [];
  for (const item of treeJson.tree ?? []) {
    if (item.type !== "blob" || !item.path) continue;
    if (!EXAMPLE_FILE.test(item.path)) continue;
    if (prefix && !item.path.startsWith(prefix + "/") && item.path !== prefix) continue;
    paths.push(item.path);
  }
  paths.sort();

  const maxFiles = options?.maxFiles ?? 200;
  if (paths.length > maxFiles) {
    warnings.push(`Truncating to ${maxFiles} of ${paths.length} matching files`);
    paths.length = maxFiles;
  }

  const files: PickedTextFile[] = [];
  let skipped = 0;
  for (const path of paths) {
    const url =
      `https://raw.githubusercontent.com/${ref.owner}/${ref.repo}/${branch}/${path}`;
    try {
      const res = await fetchFn(url);
      if (!res.ok) {
        warnings.push(`Failed ${path}: HTTP ${res.status}`);
        skipped++;
        continue;
      }
      files.push({
        name: path.split("/").pop() ?? path,
        text: await res.text(),
      });
    } catch (e) {
      warnings.push(`Failed ${path}: ${(e as Error).message}`);
      skipped++;
    }
  }

  return { files, warnings, fetched: files.length, skipped };
}

function githubApiHeaders(token?: string): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "intehrgrator-github-examples",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}
