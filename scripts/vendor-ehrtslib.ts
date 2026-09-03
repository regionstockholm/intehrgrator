import { ensureDir } from "@std/fs";
import { join } from "@std/path";

type VendorSpec = {
  dir: string;
  url: string;
};

const repos: VendorSpec[] = [
  {
    dir: "ehrtslib",
    // origin/main includes the scoped at-code / C_ARCHETYPE_ROOT fix
    // (ErikSundvall/ehrtslib@ac845d6, 2026-08-20).
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

const VANILLA_ORDINAL_HANDLER = `  if (mapped === "C_QUANTITY") return parseCQuantity(n);
  if (mapped === "C_TERMINOLOGY_CODE") return parseCTerminologyCode(n);`;

const PATCHED_ORDINAL_HANDLER = `  if (mapped === "C_QUANTITY") return parseCQuantity(n);
  if (mapped === "C_ORDINAL") {
    return parseCOrdinal(n) as unknown as openehr_am.C_OBJECT;
  }
  if (mapped === "C_TERMINOLOGY_CODE") return parseCTerminologyCode(n);`;

const PARSE_C_ORDINAL_FN = `
function parseCOrdinal(n: Record<string, unknown>): openehr_am.C_ORDINAL {
  const o = new openehr_am.C_ORDINAL();
  applyOccurrence(o, n);
  o.rm_type_name = String(n.rm_type_name ?? "DV_ORDINAL");

  const items = asArray(n.list).map((entry) => {
    const rec = entry as Record<string, unknown>;
    const item: {
      value?: number;
      symbol?: { code_string?: string; terminology_id?: string };
    } = {};
    if (rec.value !== undefined && rec.value !== null && rec.value !== "") {
      item.value = Number(rec.value);
    }
    const symbol = parseOrdinalSymbol(rec.symbol as Record<string, unknown> | undefined);
    if (symbol) item.symbol = symbol;
    return item;
  }).filter((item) => item.value !== undefined && item.symbol?.code_string);
  if (items.length) (o as { list?: typeof items }).list = items;

  if (n.assumed_value && typeof n.assumed_value === "object") {
    const assumed = n.assumed_value as Record<string, unknown>;
    const av: { value?: number; symbol?: { code_string?: string; terminology_id?: string } } = {};
    if (assumed.value !== undefined && assumed.value !== null && assumed.value !== "") {
      av.value = Number(assumed.value);
    }
    const symbol = parseOrdinalSymbol(assumed.symbol as Record<string, unknown> | undefined);
    if (symbol) av.symbol = symbol;
    if (av.value !== undefined || av.symbol) {
      (o as { assumed_value?: typeof av }).assumed_value = av;
    }
  }

  return o;
}

function parseOrdinalSymbol(
  symbol: Record<string, unknown> | undefined,
): { code_string?: string; terminology_id?: string } | undefined {
  if (!symbol || typeof symbol !== "object") return undefined;
  const defining = symbol.defining_code as Record<string, unknown> | undefined;
  const code = textValue(defining?.code_string) ?? textValue(defining) ??
    textValue(symbol.code_string);
  if (!code) return undefined;
  const tid = defining?.terminology_id ?? symbol.terminology_id;
  const terminology_id = textValue(
    typeof tid === "object" && tid ? (tid as Record<string, unknown>).value ?? tid : tid,
  );
  return { code_string: code, ...(terminology_id ? { terminology_id } : {}) };
}
`;

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
    await preserveOptOrdinalLists(vendorDir);
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

/**
 * Vanilla ehrtslib maps C_DV_ORDINAL to C_ORDINAL but falls through to
 * C_PRIMITIVE_OBJECT without parsing list[] — scaffold needs value + symbol.
 */
async function preserveOptOrdinalLists(vendorDir: string): Promise<void> {
  const path = join(vendorDir, "parser/legacy/xml_aom_mapper.ts");
  const raw = await Deno.readTextFile(path);
  if (raw.includes("function parseCOrdinal(")) {
    console.log("ehrtslib already preserves C_ORDINAL.list");
    return;
  }
  const crlf = raw.includes("\r\n");
  const src = raw.replaceAll("\r\n", "\n");
  let next = src.replace(VANILLA_ORDINAL_HANDLER, PATCHED_ORDINAL_HANDLER);
  if (next === src) {
    throw new Error(
      "ehrtslib xml_aom_mapper.ts no longer matches the C_ORDINAL patch; update scripts/vendor-ehrtslib.ts",
    );
  }
  const anchor = "/** Terms on this XML node only — not descendants (nested C_ARCHETYPE_ROOT). */";
  if (!next.includes(anchor)) {
    throw new Error("ehrtslib xml_aom_mapper.ts anchor for parseCOrdinal insert not found");
  }
  next = next.replace(anchor, `${PARSE_C_ORDINAL_FN}\n${anchor}`);
  await Deno.writeTextFile(path, crlf ? next.replaceAll("\n", "\r\n") : next);
  console.log("ehrtslib: preserved OPT C_ORDINAL.list parsing");
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
