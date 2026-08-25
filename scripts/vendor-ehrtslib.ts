import { ensureDir } from "@std/fs";
import { join } from "@std/path";

type VendorSpec = {
  dir: string;
  url: string;
};

const repos: VendorSpec[] = [
  {
    dir: "ehrtslib",
    // origin/main includes scoped at-code / C_ARCHETYPE_ROOT (ac845d6) and
    // differential `.t.json` overlay-parent closure (2f395bb+, issue #64).
    url: "https://github.com/ErikSundvall/ehrtslib.git",
  },
  {
    dir: "openEHR-model-examples",
    url: "https://github.com/Ehrlibs/openEHR-model-examples.git",
  },
];

const VANILLA_TERMINOLOGY_CODES = `  const fromList = asArray(n.code_list).map(String);
  const fromConstraint = asArray(n.constraint).filter((x) =>
    typeof x === "string"
  ).map(String);
  const codes = fromList.length ? fromList : fromConstraint;
  if (codes.length === 1) t.constraint = codes[0];

  if (!t.constraint) {`;

const PATCHED_TERMINOLOGY_CODES = `  const fromList = asArray(n.code_list).map(String).filter((c) => c && c !== "undefined");
  const fromConstraint = asArray(n.constraint).filter((x) =>
    typeof x === "string"
  ).map(String);
  const codes = fromList.length ? fromList : fromConstraint;
  // AOM2 \`constraint\` is a single at/ac-code. ADL 1.4 OPT \`code_list\` is the
  // expanded local value set — keep it so consumers can scaffold all choices.
  if (codes.length === 1) t.constraint = codes[0];
  if (codes.length) (t as { code_list?: string[] }).code_list = codes;

  if (n.assumed_value && typeof n.assumed_value === "object") {
    const assumed = n.assumed_value as Record<string, unknown>;
    const code = textValue(assumed.code_string) ?? textValue(assumed);
    if (code) {
      (t as { assumed_value?: { code_string: string; terminology_id?: string } })
        .assumed_value = {
          code_string: code,
          terminology_id: textValue(
            (assumed.terminology_id as Record<string, unknown> | undefined)
              ?.value ?? assumed.terminology_id,
          ),
        };
    }
  }

  if (!t.constraint && !codes.length) {`;

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
  const { dir, url } = spec;
  const vendorDir = join(Deno.cwd(), "vendor", dir);
  const hasGit = await exists(join(vendorDir, ".git"));

  if (!hasGit) {
    try {
      await Deno.remove(vendorDir, { recursive: true });
    } catch {
      // nothing to replace
    }
    console.log(`Cloning ${dir} into ${vendorDir}…`);
    await runGit(["clone", "--depth", "1", url, vendorDir]);
  } else {
    // Always reset to origin/main so a previous pin or local drift cannot hide
    // upstream breaks from CI.
    console.log(`Updating ${dir} to origin/main…`);
    await runGit(["-C", vendorDir, "fetch", "--depth", "1", "origin", "main"]);
    await runGit(["-C", vendorDir, "checkout", "-B", "main", "origin/main"]);
    await runGit(["-C", vendorDir, "reset", "--hard", "origin/main"]);
  }

  const sha = await revParse(vendorDir);
  console.log(`${dir} at ${sha} (origin/main)`);

  if (dir === "ehrtslib") {
    await preserveOptCodeLists(vendorDir);
  }
}

/**
 * Vanilla ehrtslib `parseCTerminologyCode` keeps a single `constraint` and
 * drops ADL 1.4 OPT `code_list` when it has more than one code. Skeleton
 * scaffolding needs the full local value set (Position, Cuff size, …).
 * Skip when origin/main already preserves `code_list`.
 */
async function preserveOptCodeLists(vendorDir: string): Promise<void> {
  const path = join(vendorDir, "parser/legacy/xml_aom_mapper.ts");
  const raw = await Deno.readTextFile(path);
  if (raw.includes("(t as { code_list?: string[] }).code_list = codes")) {
    console.log("ehrtslib already preserves C_TERMINOLOGY_CODE.code_list");
    return;
  }
  const crlf = raw.includes("\r\n");
  const src = raw.replaceAll("\r\n", "\n");
  const next = src.replace(VANILLA_TERMINOLOGY_CODES, PATCHED_TERMINOLOGY_CODES);
  if (next === src) {
    throw new Error(
      "ehrtslib xml_aom_mapper.ts no longer matches the code_list patch; update scripts/vendor-ehrtslib.ts",
    );
  }
  await Deno.writeTextFile(path, crlf ? next.replaceAll("\n", "\r\n") : next);
  console.log("ehrtslib: preserved OPT code_list on C_TERMINOLOGY_CODE");
}

async function revParse(cwd: string): Promise<string> {
  const { success, stdout } = await new Deno.Command("git", {
    args: ["-C", cwd, "rev-parse", "--short=7", "HEAD"],
    stdout: "piped",
    stderr: "null",
  }).output();
  if (!success) return "unknown";
  return new TextDecoder().decode(stdout).trim() || "unknown";
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
