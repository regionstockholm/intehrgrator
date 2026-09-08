/**
 * Assemble GitHub Pages deploy trees with immutable version subdirectories.
 */
import { copy, ensureDir, emptyDir, walk } from "@std/fs";
import { dirname, join } from "@std/path";

export const PAGES_SITE_URL = "https://regionstockholm.github.io/intehrgrator";
export const VERSIONS_MANIFEST = "versions.json";

export interface VersionsManifest {
  versions: string[];
}

export function emptyManifest(): VersionsManifest {
  return { versions: [] };
}

export function normalizeManifest(raw: unknown): VersionsManifest {
  if (!raw || typeof raw !== "object") return emptyManifest();
  const versions = (raw as VersionsManifest).versions;
  if (!Array.isArray(versions)) return emptyManifest();
  return {
    versions: [...new Set(versions.filter((v) => typeof v === "string" && v.startsWith("v")))]
      .sort()
      .reverse(),
  };
}

export async function readVersionsManifest(path: string): Promise<VersionsManifest> {
  try {
    const text = await Deno.readTextFile(path);
    return normalizeManifest(JSON.parse(text));
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return emptyManifest();
    throw error;
  }
}

export async function writeVersionsManifest(path: string, manifest: VersionsManifest): Promise<void> {
  const normalized = normalizeManifest(manifest);
  await ensureDir(dirname(path));
  await Deno.writeTextFile(path, `${JSON.stringify(normalized, null, 2)}\n`);
}

export async function fetchVersionsManifest(baseUrl: string): Promise<VersionsManifest> {
  try {
    const res = await fetch(`${baseUrl}/${VERSIONS_MANIFEST}`);
    if (!res.ok) return emptyManifest();
    return normalizeManifest(await res.json());
  } catch {
    return emptyManifest();
  }
}

/** Path segments under the host in `baseUrl` (e.g. intehrgrator → 1). */
export function pagesRepoPathDepth(baseUrl: string): number {
  const path = new URL(baseUrl).pathname.replace(/^\/+|\/+$/g, "");
  if (!path) return 0;
  return path.split("/").filter(Boolean).length;
}

async function runWget(args: string[]): Promise<void> {
  const status = await new Deno.Command("wget", {
    args,
    stdout: "inherit",
    stderr: "inherit",
  }).output();
  // 8 = some files missing on partial mirrors; acceptable for Pages trees.
  if (!status.success && status.code !== 8) {
    throw new Error(`wget failed (exit ${status.code})`);
  }
}

/** Flatten wget output when it nests under the final URL path segment. */
export async function flattenWgetNest(dest: string, nestedName: string): Promise<void> {
  const nested = join(dest, nestedName);
  try {
    await Deno.stat(nested);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return;
    throw error;
  }
  for await (const entry of walk(nested, { includeDirs: false })) {
    const rel = entry.path.slice(nested.length + 1);
    const target = join(dest, rel);
    await ensureDir(dirname(target));
    await Deno.rename(entry.path, target);
  }
  await Deno.remove(nested, { recursive: true });
}

export async function versionHasIndex(root: string, tag: string): Promise<boolean> {
  try {
    const st = await Deno.stat(join(root, tag, "index.html"));
    return st.isFile;
  } catch {
    return false;
  }
}

/** Mirror the live Pages site (root + frozen versions) into dest. */
export async function mirrorLiveSite(baseUrl: string, dest: string): Promise<void> {
  await emptyDir(dest);
  await ensureDir(dest);
  const cut = pagesRepoPathDepth(baseUrl);
  const args = ["-q", "-r", "-np", "-nH"];
  if (cut > 0) args.push(`--cut-dirs=${cut}`);
  args.push("-P", dest, `${baseUrl}/`);
  await runWget(args);
  // Older mirrors / alternate wget layouts may still nest under the repo segment.
  const repoSeg = new URL(baseUrl).pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean).pop();
  if (repoSeg) await flattenWgetNest(dest, repoSeg);
}

/**
 * Mirror a single frozen version subdirectory from the live Pages site.
 * Fails if `index.html` is missing so we never publish empty `/vX.Y/` dirs.
 */
export async function mirrorVersionSubdir(
  baseUrl: string,
  tag: string,
  destRoot: string,
): Promise<void> {
  const dest = join(destRoot, tag);
  await emptyDir(dest);
  await ensureDir(dest);
  // URL path is /<repo>/<tag>/… — cut both so files land directly in dest/.
  const cut = pagesRepoPathDepth(baseUrl) + 1;
  const args = ["-q", "-r", "-np", "-nH", `--cut-dirs=${cut}`, "-P", dest, `${baseUrl}/${tag}/`];
  await runWget(args);
  // Belt-and-suspenders for layouts that still nest.
  const repoSeg = new URL(baseUrl).pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean).pop();
  if (repoSeg) await flattenWgetNest(dest, repoSeg);
  await flattenWgetNest(dest, tag);

  if (!(await versionHasIndex(destRoot, tag))) {
    throw new Error(
      `Failed to mirror frozen Pages version /${tag}/ — index.html missing after wget`,
    );
  }
}

async function copyDistContents(src: string, dest: string): Promise<void> {
  await ensureDir(dest);
  await copy(src, dest, { overwrite: true, recursive: true });
}

/**
 * Main-branch deploy: publish bleeding-edge root and keep frozen version subdirs.
 * Versions that cannot be mirrored are dropped from the manifest (never publish empty dirs).
 */
export async function assembleMainPagesSite(opts: {
  baseUrl: string;
  rootDist: string;
  outDir: string;
}): Promise<VersionsManifest> {
  await emptyDir(opts.outDir);
  await copyDistContents(opts.rootDist, opts.outDir);

  const listed = await fetchVersionsManifest(opts.baseUrl);
  const preserved: string[] = [];
  for (const tag of listed.versions) {
    try {
      await mirrorVersionSubdir(opts.baseUrl, tag, opts.outDir);
      preserved.push(tag);
    } catch (error) {
      console.warn(
        `Dropping frozen Pages version ${tag}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      try {
        await Deno.remove(join(opts.outDir, tag), { recursive: true });
      } catch {
        // ignore cleanup errors
      }
    }
  }

  const manifest = normalizeManifest({ versions: preserved });
  await writeVersionsManifest(join(opts.outDir, VERSIONS_MANIFEST), manifest);
  return manifest;
}

/**
 * Release deploy: add an immutable version subdirectory without changing site root.
 */
export async function assembleReleasePagesSite(opts: {
  baseUrl: string;
  versionTag: string;
  versionDist: string;
  outDir: string;
}): Promise<VersionsManifest> {
  const listed = await fetchVersionsManifest(opts.baseUrl);
  if (listed.versions.includes(opts.versionTag)) {
    throw new Error(
      `GitHub Pages version ${opts.versionTag} already exists — release web builds are immutable`,
    );
  }

  await mirrorLiveSite(opts.baseUrl, opts.outDir);

  // Keep only frozen versions that actually mirrored with an index.html.
  const preserved: string[] = [];
  for (const tag of listed.versions) {
    if (await versionHasIndex(opts.outDir, tag)) {
      preserved.push(tag);
      continue;
    }
    // Root wget often does not recurse into unlinked version dirs — fetch each explicitly.
    try {
      await mirrorVersionSubdir(opts.baseUrl, tag, opts.outDir);
      preserved.push(tag);
    } catch (error) {
      console.warn(
        `Not preserving missing frozen Pages version ${tag}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      try {
        await Deno.remove(join(opts.outDir, tag), { recursive: true });
      } catch {
        // ignore
      }
    }
  }

  if (await versionHasIndex(opts.outDir, opts.versionTag)) {
    throw new Error(
      `GitHub Pages path /${opts.versionTag}/ already exists — release web builds are immutable`,
    );
  }

  await copyDistContents(opts.versionDist, join(opts.outDir, opts.versionTag));
  if (!(await versionHasIndex(opts.outDir, opts.versionTag))) {
    throw new Error(`Release dist for ${opts.versionTag} is missing index.html`);
  }

  const next: VersionsManifest = {
    versions: normalizeManifest({ versions: [...preserved, opts.versionTag] }).versions,
  };
  await writeVersionsManifest(join(opts.outDir, VERSIONS_MANIFEST), next);
  return next;
}
