#!/usr/bin/env -S deno run -A
/**
 * Cut a desktop + GitHub Pages release.
 *
 * Bumps version files (unless --current), runs tests/build, commits, tags, and pushes.
 * GitHub Actions (release.yml) publishes desktop binaries and a frozen Pages subdirectory.
 *
 * Usage:
 *   deno task release -- --version 0.6.0
 *   deno task release -- --current          # tag current deno.json version
 *   deno task release -- --version 0.6.0 --dry-run
 */
import {
  assertCleanGitTree,
  assertGhAuth,
  assertReleasePrerequisites,
  bumpVersionFiles,
  readCurrentVersion,
  releaseTagForVersion,
  run,
} from "./release_version.ts";

function usage(): void {
  console.log(`Usage:
  deno task release -- --version <semver> [--message <tag message>] [--dry-run]
  deno task release -- --current [--message <tag message>] [--dry-run]

Options:
  --version   New package version to write before releasing
  --current   Release the version already in deno.json (no bump)
  --message   Annotated tag message (default: intEHRgrator desktop <version>)
  --dry-run   Validate and build, but do not commit, tag, or push
`);
}

function parseArgs(argv: string[]) {
  let version: string | undefined;
  let useCurrent = false;
  let dryRun = false;
  let message: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--version") {
      version = argv[++i];
      continue;
    }
    if (arg === "--current") {
      useCurrent = true;
      continue;
    }
    if (arg === "--message") {
      message = argv[++i];
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      usage();
      Deno.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (version && useCurrent) throw new Error("Use either --version or --current, not both");
  if (!version && !useCurrent) throw new Error("Pass --version <semver> or --current");

  return { version, useCurrent, dryRun, message };
}

const args = parseArgs(Deno.args);

await assertReleasePrerequisites();
if (!args.dryRun) {
  await assertGhAuth();
  await assertCleanGitTree();
}

let releaseVersion = args.version;
if (args.useCurrent) {
  releaseVersion = await readCurrentVersion();
}
if (!releaseVersion) throw new Error("Release version is required");

const releaseTag = releaseTagForVersion(releaseVersion);
const tagMessage = args.message ?? `intEHRgrator desktop ${releaseVersion}`;

console.log(`Preparing release ${releaseVersion} (${releaseTag})`);

if (args.version) {
  console.log(`Bumping version files to ${args.version}`);
  await bumpVersionFiles(args.version);
  releaseVersion = args.version;
}

await run("deno", ["task", "vendor"]);
await run("deno", ["task", "test"]);
await run("deno", ["task", "build"]);

if (args.dryRun) {
  console.log("Dry run complete — no commit, tag, or push performed.");
  console.log(`Would tag ${releaseTag} and push to origin; Actions publishes desktop + Pages /${releaseTag}/`);
  Deno.exit(0);
}

if (args.version) {
  await run("git", ["add", ...[
    "deno.json",
    "package.json",
    "scripts/desktop.compile.json",
    "src/core/persistence/mod.ts",
  ]]);
  await run("git", ["commit", "-m", `chore: release ${releaseVersion}`]);
}

await run("git", ["tag", "-a", releaseTag, "-m", tagMessage]);
await run("git", ["push", "origin", "HEAD"]);
await run("git", ["push", "origin", releaseTag]);

console.log(`Pushed ${releaseTag}.`);
console.log(`GitHub Actions will publish desktop binaries and https://regionstockholm.github.io/intehrgrator/${releaseTag}/`);
