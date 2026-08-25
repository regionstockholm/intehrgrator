/**
 * Cross-compile the intEHRgrator desktop workbench for Windows, macOS, and Linux.
 * Output: dist/release/intEHRgrator-<platform>/
 */
import { ensureDir } from "@std/fs";
import { dirname, fromFileUrl, join } from "@std/path";

const root = join(dirname(fromFileUrl(import.meta.url)), "..");

const TARGETS = [
  {
    target: "x86_64-pc-windows-msvc",
    output: join("dist", "release", "intEHRgrator-windows-x64"),
  },
  {
    target: "x86_64-unknown-linux-gnu",
    output: join("dist", "release", "intEHRgrator-linux-x64.AppImage"),
  },
  {
    target: "x86_64-apple-darwin",
    output: join("dist", "release", "intEHRgrator-macos-x64.app"),
  },
  {
    target: "aarch64-apple-darwin",
    output: join("dist", "release", "intEHRgrator-macos-arm64.app"),
  },
] as const;

const stage = await new Deno.Command("deno", {
  args: ["run", "-A", "scripts/stage-desktop-www.ts"],
  cwd: root,
  stdout: "inherit",
  stderr: "inherit",
}).output();
if (!stage.success) Deno.exit(stage.code);

await ensureDir(join(root, "dist", "release"));

const entry = "src/desktop/main.ts";
let failed = 0;

for (const { target, output } of TARGETS) {
  console.log(`Desktop ${target} → ${output}`);
  const args = [
    "desktop",
    "-A",
    "--no-check",
    "--no-npm",
    "--config",
    "scripts/desktop.compile.json",
    "--backend",
    "webview",
    "--target",
    target,
    "--output",
    output,
    "--include",
    "src/desktop/www",
    entry,
  ];
  const cmd = new Deno.Command("deno", {
    args,
    cwd: root,
    stdout: "inherit",
    stderr: "inherit",
  });
  const status = await cmd.output();
  if (!status.success) {
    console.error(`Failed: ${target} (exit ${status.code})`);
    failed++;
  }
}

if (failed) {
  console.error(`${failed} of ${TARGETS.length} targets failed`);
  Deno.exit(1);
}

const archives = [
  {
    src: join("dist", "release", "intEHRgrator-windows-x64"),
    zip: join("dist", "release", "intEHRgrator-windows-x64.zip"),
  },
  {
    src: join("dist", "release", "intEHRgrator-macos-x64.app"),
    zip: join("dist", "release", "intEHRgrator-macos-x64.zip"),
  },
  {
    src: join("dist", "release", "intEHRgrator-macos-arm64.app"),
    zip: join("dist", "release", "intEHRgrator-macos-arm64.zip"),
  },
] as const;

for (const { src, zip } of archives) {
  try {
    await Deno.remove(zip);
  } catch {
    // no previous zip
  }
  console.log(`Zipping ${src} → ${zip}`);
  const status = await new Deno.Command("tar", {
    args: ["-a", "-c", "-f", zip, "-C", join(root, "dist", "release"), src.split(/[/\\]/).pop()!],
    cwd: root,
    stdout: "inherit",
    stderr: "inherit",
  }).output();
  if (!status.success) {
    console.error(`Zip failed: ${zip}`);
    Deno.exit(status.code);
  }
}

console.log(`Wrote ${TARGETS.length} desktop apps to dist/release/`);
