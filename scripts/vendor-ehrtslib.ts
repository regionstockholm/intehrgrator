import { ensureDir } from "@std/fs";
import { join } from "@std/path";

type VendorSpec = {
  dir: string;
  url: string;
  /** Pin a commit so CI does not float on breaking upstream layout changes. */
  ref?: string;
};

const repos: VendorSpec[] = [
  {
    dir: "ehrtslib",
    url: "https://github.com/ErikSundvall/ehrtslib.git",
    // Last layout with enhanced/parser + enhanced/meta (later main moved those).
    ref: "acf6824b347d451a573303bd01441e33aa27318d",
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
    await vendorRepo(spec);
  } catch (err) {
    failed = true;
    console.error(err instanceof Error ? err.message : String(err));
  }
}
if (failed) Deno.exit(1);

async function vendorRepo(spec: VendorSpec): Promise<void> {
  const { dir, url, ref } = spec;
  const vendorDir = join(Deno.cwd(), "vendor", dir);
  const hasGit = await exists(join(vendorDir, ".git"));

  if (!hasGit) {
    try {
      await Deno.remove(vendorDir, { recursive: true });
    } catch {
      // nothing to replace
    }
    console.log(`Cloning ${dir} into ${vendorDir}…`);
    if (ref) {
      await checkoutPinned(vendorDir, url, ref);
    } else {
      await runGit(["clone", "--depth", "1", url, vendorDir]);
    }
    console.log(`Cloned ${dir} to ${vendorDir}`);
    return;
  }

  if (ref) {
    console.log(`Checking out ${dir} at ${ref.slice(0, 7)}…`);
    await runGit(["-C", vendorDir, "fetch", "--depth", "1", "origin", ref]);
    await runGit(["-C", vendorDir, "checkout", "--detach", "FETCH_HEAD"]);
    console.log(`${dir} at ${ref.slice(0, 7)}`);
    return;
  }

  console.log(`Updating ${dir} in ${vendorDir}…`);
  await runGit(["-C", vendorDir, "pull", "--ff-only", "origin", "main"]);
  console.log(`${dir} updated`);
}

async function checkoutPinned(vendorDir: string, url: string, ref: string): Promise<void> {
  await runGit(["init", vendorDir]);
  await runGit(["-C", vendorDir, "remote", "add", "origin", url]);
  await runGit(["-C", vendorDir, "fetch", "--depth", "1", "origin", ref]);
  await runGit(["-C", vendorDir, "checkout", "--detach", "FETCH_HEAD"]);
}

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
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
