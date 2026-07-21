import { ensureDir } from "@std/fs";
import { join } from "@std/path";

const vendorDir = join(Deno.cwd(), "vendor", "ehrtslib");
const repo = "https://github.com/ErikSundvall/ehrtslib.git";

try {
  await Deno.stat(vendorDir);
  console.log(`Updating ehrtslib in ${vendorDir}…`);
  const pull = new Deno.Command("git", {
    args: ["-C", vendorDir, "pull", "--ff-only", "origin", "main"],
    stdout: "inherit",
    stderr: "inherit",
  });
  const status = await pull.spawn().status;
  if (!status.success) Deno.exit(status.code);
  console.log("ehrtslib updated");
} catch {
  await ensureDir(join(Deno.cwd(), "vendor"));
  const clone = new Deno.Command("git", {
    args: ["clone", "--depth", "1", repo, vendorDir],
    stdout: "inherit",
    stderr: "inherit",
  });
  const status = await clone.spawn().status;
  if (!status.success) Deno.exit(status.code);
  console.log(`Cloned ehrtslib to ${vendorDir}`);
}
