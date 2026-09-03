/**
 * Compile go/texttemplate to WASM and copy wasm_exec.js beside it.
 *
 * Requires a Go toolchain (`go version`). Output:
 *   web/wasm/go_texttemplate.wasm
 *   web/wasm/wasm_exec.js
 *
 * `vendor/` is gitignored (ehrtslib); these files live under `web/` so the
 * Web Shell can load them and tests can read them without a Go toolchain.
 */
import { copy, ensureDir } from "@std/fs";
import { dirname, fromFileUrl, join } from "@std/path";

const root = join(dirname(fromFileUrl(import.meta.url)), "..");
const outDir = join(root, "web", "wasm");
const wasmOut = join(outDir, "go_texttemplate.wasm");
const pkgDir = join(root, "go", "texttemplate");

await ensureDir(outDir);

const goEnv = await new Deno.Command("go", { args: ["env", "GOROOT"], stdout: "piped" }).output();
if (!goEnv.success) {
  throw new Error("go is not available — install a Go toolchain to rebuild the WASM artifact");
}
const goroot = new TextDecoder().decode(goEnv.stdout).trim();
const wasmExecCandidates = [
  join(goroot, "misc", "wasm", "wasm_exec.js"),
  join(goroot, "lib", "wasm", "wasm_exec.js"),
];
let wasmExecSrc: string | null = null;
for (const candidate of wasmExecCandidates) {
  try {
    await Deno.stat(candidate);
    wasmExecSrc = candidate;
    break;
  } catch {
    // try next
  }
}
if (!wasmExecSrc) {
  throw new Error(`wasm_exec.js not found under ${goroot}`);
}

const build = await new Deno.Command("go", {
  args: ["build", "-ldflags=-s -w", "-o", wasmOut, "."],
  cwd: pkgDir,
  env: {
    ...Deno.env.toObject(),
    GOOS: "js",
    GOARCH: "wasm",
    CGO_ENABLED: "0",
  },
  stdout: "inherit",
  stderr: "inherit",
}).output();
if (!build.success) {
  throw new Error(`go build failed with code ${build.code}`);
}

await copy(wasmExecSrc, join(outDir, "wasm_exec.js"), { overwrite: true });
const stat = await Deno.stat(wasmOut);
console.log(
  `Wrote ${wasmOut} (${stat.size} bytes) and wasm_exec.js from ${wasmExecSrc}`,
);
