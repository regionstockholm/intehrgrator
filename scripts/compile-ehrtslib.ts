/**
 * Cross-compile the offline ehrtslib CLI for Windows, macOS, and Linux.
 * Output: dist/release/ehrtslib-<target>[.exe]
 */
import { ensureDir } from "@std/fs";
import { join } from "@std/path";

const TARGETS = [
  { target: "x86_64-pc-windows-msvc", name: "ehrtslib-x86_64-pc-windows-msvc.exe" },
  { target: "x86_64-unknown-linux-gnu", name: "ehrtslib-x86_64-unknown-linux-gnu" },
  { target: "x86_64-apple-darwin", name: "ehrtslib-x86_64-apple-darwin" },
  { target: "aarch64-apple-darwin", name: "ehrtslib-aarch64-apple-darwin" },
] as const;

const outDir = join("dist", "release");
await ensureDir(outDir);

const entry = "src/cli/ehrtslib.ts";
let failed = 0;

for (const { target, name } of TARGETS) {
  const dest = join(outDir, name);
  console.log(`Compiling ${target} → ${dest}`);
  const cmd = new Deno.Command("deno", {
    args: [
      "compile",
      "-A",
      "--no-check",
      "--target",
      target,
      "--output",
      dest,
      entry,
    ],
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
console.log(`Wrote ${TARGETS.length} binaries to ${outDir}`);
