import { ensureDir } from "@std/fs";
import { join } from "@std/path";

const vendorDir = join(Deno.cwd(), "vendor", "ehrtslib");
const repo = "https://github.com/ErikSundvall/ehrtslib.git";

const proc = new Deno.Command("git", {
  args: ["clone", "--depth", "1", repo, vendorDir],
  stdout: "inherit",
  stderr: "inherit",
});

try {
  await Deno.stat(vendorDir);
  console.log(`ehrtslib already present at ${vendorDir}`);
} catch {
  await ensureDir(join(Deno.cwd(), "vendor"));
  const status = await proc.spawn().status;
  if (!status.success) Deno.exit(status.code);
  console.log(`Cloned ehrtslib to ${vendorDir}`);
}
