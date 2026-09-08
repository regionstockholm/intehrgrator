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
async function flattenWgetNest(dest: string, nestedName: string): Promise<void> {
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

/** Mirror the live Pages site (root + frozen versions) into dest. */
export async function mirrorLiveSite(baseUrl: string, dest: string): Promise<void> {
  await emptyDir(dest);
  await ensureDir(dest);
  await runWget(["-q", "-r", "-np", "-nH", "-P", dest, `${baseUrl}/`]);
  await flattenWgetNest(dest, "intehrgrator");
}

/** Mirror a single frozen version subdirectory from the live Pages site. */
export async function mirrorVersionSubdir(
  baseUrl: string,
  tag: string,
  destRoot: string,
): Promise<void> {
  const dest = join(destRoot, tag);
  await emptyDir(dest);
  await ensureDir(dest);
  await runWget(["-q", "-r", "-np", "-nH", "-P", dest, `${baseUrl}/${tag}/`]);
  await flattenWgetNest(dest, tag);
}

async function copyDistContents(src: string, dest: string): Promise<void> {
  await ensureDir(dest);
  await copy(src, dest, { overwrite: true, recursive: true });
}

/**
 * Main-branch deploy: publish bleeding-edge root and keep frozen version subdirs.
 */
export async function assembleMainPagesSite(opts: {
  baseUrl: string;
  rootDist: string;
  outDir: string;
}): Promise<VersionsManifest> {
  await emptyDir(opts.outDir);
  await copyDistContents(opts.rootDist, opts.outDir);

  const manifest = await fetchVersionsManifest(opts.baseUrl);
  for (const tag of manifest.versions) {
    await mirrorVersionSubdir(opts.baseUrl, tag, opts.outDir);
  }

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
  const manifest = await fetchVersionsManifest(opts.baseUrl);
  if (manifest.versions.includes(opts.versionTag)) {
    throw new Error(
      `GitHub Pages version ${opts.versionTag} already exists — release web builds are immutable`,
    );
  }

  await mirrorLiveSite(opts.baseUrl, opts.outDir);

  try {
    await Deno.stat(join(opts.outDir, opts.versionTag));
    throw new Error(
      `GitHub Pages path /${opts.versionTag}/ already exists — release web builds are immutable`,
    );
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }

  await copyDistContents(opts.versionDist, join(opts.outDir, opts.versionTag));

  const next: VersionsManifest = {
    versions: normalizeManifest({ versions: [...manifest.versions, opts.versionTag] }).versions,
  };
  await writeVersionsManifest(join(opts.outDir, VERSIONS_MANIFEST), next);
  return next;
}
