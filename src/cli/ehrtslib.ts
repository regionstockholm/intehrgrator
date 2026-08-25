/**
 * Offline ehrtslib CLI — parse local clinical models with no GitHub/network.
 * Developer helper in this repo; ship binaries from the ehrtslib GitHub, not
 * as an intEHRgrator release.
 *
 *   ehrtslib info <file>
 *   ehrtslib web-template <file> [-o out.json]
 *   ehrtslib opt <file> [-o out.opt]
 *   ehrtslib flatten <file> --models-dir <dir> [-o out.opt]
 */
import { join } from "@std/path";
import {
  ClinicalModelWorkspace,
  isClinicalModelPath,
  parseTemplateInput,
} from "ehrtslib/parser/mod.ts";
import { OptXmlSerializer } from "ehrtslib/generation/opt_xml_serializer.ts";
import { buildWebTemplate } from "ehrtslib/serialization/simplified/mod.ts";

const USAGE = `ehrtslib — local openEHR clinical-model tool (no network)

Usage:
  ehrtslib info <file>
  ehrtslib web-template <file> [-o out.json]
  ehrtslib opt <file> [-o out.opt]
  ehrtslib flatten <file> --models-dir <dir> [-o out.opt]

<file> is a local .opt, .oet, .t.json, or .adl. flatten loads every
clinical-model file under --models-dir so differential .t.json overlays
can specialise against parent archetypes on disk.
`;

async function main(args: string[]): Promise<number> {
  if (args.length === 0 || args[0] === "-h" || args[0] === "--help") {
    console.log(USAGE);
    return 0;
  }
  const command = args[0];
  if (command === "info") {
    const file = requireArg(args[1], "file");
    return await cmdInfo(file);
  }
  if (command === "web-template") {
    const { file, out } = parseFileOut(args.slice(1));
    return await cmdWebTemplate(file, out);
  }
  if (command === "opt") {
    const { file, out } = parseFileOut(args.slice(1));
    return await cmdOpt(file, out);
  }
  if (command === "flatten") {
    const { file, out, modelsDir } = parseFlatten(args.slice(1));
    return await cmdFlatten(file, modelsDir, out);
  }
  console.error(`Unknown command: ${command}\n`);
  console.error(USAGE);
  return 2;
}

function requireArg(value: string | undefined, name: string): string {
  if (!value || value.startsWith("-")) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function parseFileOut(args: string[]): { file: string; out?: string } {
  let file: string | undefined;
  let out: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "-o" || a === "--out") {
      out = requireArg(args[++i], "output path");
    } else if (!a.startsWith("-")) {
      file = a;
    } else {
      throw new Error(`Unknown flag: ${a}`);
    }
  }
  return { file: requireArg(file, "file"), out };
}

function parseFlatten(
  args: string[],
): { file: string; out?: string; modelsDir: string } {
  let file: string | undefined;
  let out: string | undefined;
  let modelsDir: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "-o" || a === "--out") {
      out = requireArg(args[++i], "output path");
    } else if (a === "--models-dir") {
      modelsDir = requireArg(args[++i], "models dir");
    } else if (!a.startsWith("-")) {
      file = a;
    } else {
      throw new Error(`Unknown flag: ${a}`);
    }
  }
  return {
    file: requireArg(file, "file"),
    out,
    modelsDir: requireArg(modelsDir, "--models-dir"),
  };
}

async function cmdInfo(path: string): Promise<number> {
  const text = await Deno.readTextFile(path);
  const parsed = parseTemplateInput(text);
  const opt = parsed.operationalTemplate as {
    template_id?: { value?: string };
    definition?: { rm_type_name?: string; attributes?: Array<{
      rm_attribute_name?: string;
      children?: Array<{ rm_type_name?: string; node_id?: string }>;
    }> };
  } | undefined;
  console.log(JSON.stringify({
    file: path,
    format: parsed.format,
    templateId: opt?.template_id?.value ?? null,
    rootRmType: opt?.definition?.rm_type_name ?? null,
    warnings: parsed.warnings,
    content: (opt?.definition?.attributes ?? [])
      .filter((a) => a.rm_attribute_name === "content")
      .flatMap((a) =>
        (a.children ?? []).map((c) => ({
          rmType: c.rm_type_name,
          nodeId: c.node_id,
        }))
      ),
  }, null, 2));
  return parsed.warnings.length ? 0 : 0;
}

async function cmdWebTemplate(path: string, out?: string): Promise<number> {
  const opt = await operationalFromFile(path);
  const wt = buildWebTemplate(opt);
  return await writeJson(wt, out);
}

async function cmdOpt(path: string, out?: string): Promise<number> {
  const opt = await operationalFromFile(path);
  const xml = new OptXmlSerializer().serialize(opt);
  return await writeText(xml, out);
}

async function cmdFlatten(
  path: string,
  modelsDir: string,
  out?: string,
): Promise<number> {
  const ws = new ClinicalModelWorkspace();
  const entries = await collectModelFiles(modelsDir);
  const rootName = path.replace(/\\/g, "/").split("/").pop()!;
  const already = entries.some((e) => e.path.endsWith("/" + rootName) || e.path === rootName);
  if (!already) {
    entries.push({
      path: rootName,
      content: await Deno.readTextFile(path),
    });
  }
  ws.addFiles(entries);
  const resolved = ws.resolveOperational();
  if (resolved.warnings.length) {
    console.error(resolved.warnings.join("\n"));
  }
  const xml = new OptXmlSerializer().serialize(resolved.operationalTemplate);
  return await writeText(xml, out);
}

async function operationalFromFile(path: string): Promise<unknown> {
  const text = await Deno.readTextFile(path);
  const parsed = parseTemplateInput(text);
  if (!parsed.operationalTemplate) {
    throw new Error(
      `Could not resolve an operational template from ${path}` +
        (parsed.warnings.length ? `: ${parsed.warnings.join("; ")}` : ""),
    );
  }
  if (parsed.warnings.length) console.error(parsed.warnings.join("\n"));
  return parsed.operationalTemplate;
}

async function collectModelFiles(
  dir: string,
): Promise<Array<{ path: string; content: string }>> {
  const out: Array<{ path: string; content: string }> = [];
  async function walk(current: string, rel: string): Promise<void> {
    for await (const entry of Deno.readDir(current)) {
      const nextRel = rel ? `${rel}/${entry.name}` : entry.name;
      const nextAbs = join(current, entry.name);
      if (entry.isDirectory) {
        await walk(nextAbs, nextRel);
      } else if (entry.isFile && isClinicalModelPath(nextRel)) {
        out.push({ path: nextRel, content: await Deno.readTextFile(nextAbs) });
      }
    }
  }
  await walk(dir, "");
  return out;
}

async function writeJson(value: unknown, out?: string): Promise<number> {
  return await writeText(JSON.stringify(value, null, 2) + "\n", out);
}

async function writeText(text: string, out?: string): Promise<number> {
  if (out) {
    await Deno.writeTextFile(out, text);
  } else {
    await Deno.stdout.write(new TextEncoder().encode(text));
  }
  return 0;
}

try {
  Deno.exit(await main(Deno.args));
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  Deno.exit(1);
}
