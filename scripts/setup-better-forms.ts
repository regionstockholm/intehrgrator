import { copy, ensureDir } from "@std/fs";
import { dirname, fromFileUrl, join, resolve } from "@std/path";

const root = join(dirname(fromFileUrl(import.meta.url)), "..");
const explicit = Deno.args.find((arg) => !arg.startsWith("-"));
const sourceRoot = resolve(
  explicit ??
    Deno.env.get("KINTEGRATE_PATH") ??
    "C:\\lokalt\\dev\\kintegrate",
);
const source = join(sourceRoot, "src", "vendor");
const destination = join(root, ".local", "better-form-renderer");
const required = ["form-renderer.js", "styles.css", "styles-theme.css"];

for (const filename of required) {
  try {
    await Deno.stat(join(source, filename));
  } catch {
    throw new Error(
      `Missing ${filename} in ${source}. Supply the Kintegrate root as the first argument or KINTEGRATE_PATH.`,
    );
  }
}

await ensureDir(destination);
for (const filename of required) {
  await copy(join(source, filename), join(destination, filename), { overwrite: true });
}

console.log(
  `Installed licensed Better Form Renderer assets locally at ${destination}. ` +
    "The directory is git-ignored.",
);
