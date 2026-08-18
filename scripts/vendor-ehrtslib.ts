import { ensureDir } from "@std/fs";
import { join } from "@std/path";

const repos = [
  {
    dir: "ehrtslib",
    url: "https://github.com/ErikSundvall/ehrtslib.git",
  },
  {
    dir: "openEHR-model-examples",
    url: "https://github.com/Ehrlibs/openEHR-model-examples.git",
  },
];

await ensureDir(join(Deno.cwd(), "vendor"));

let failed = false;
for (const spec of repos) {
  try {
    await vendorRepo(spec.dir, spec.url);
  } catch (err) {
    failed = true;
    console.error(err instanceof Error ? err.message : String(err));
  }
}
if (failed) Deno.exit(1);

async function vendorRepo(dir: string, repo: string): Promise<void> {
  const vendorDir = join(Deno.cwd(), "vendor", dir);
  try {
    await Deno.stat(join(vendorDir, ".git"));
    console.log(`Updating ${dir} in ${vendorDir}…`);
    await runGit(["-C", vendorDir, "pull", "--ff-only", "origin", "main"]);
    console.log(`${dir} updated`);
    return;
  } catch {
    // missing or not a git checkout — clone
  }

  try {
    await Deno.remove(vendorDir, { recursive: true });
  } catch {
    // nothing to replace
  }

  console.log(`Cloning ${dir} into ${vendorDir}…`);
  await runGit(["clone", "--depth", "1", repo, vendorDir]);
  console.log(`Cloned ${dir} to ${vendorDir}`);
}

async function runGit(args: string[]): Promise<void> {
  const status = await new Deno.Command("git", {
    args,
    stdout: "inherit",
    stderr: "inherit",
  }).spawn().status;
  if (!status.success) {
    throw new Error(`git ${args.join(" ")} failed (${status.code})`);
  }
}
