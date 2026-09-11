#!/usr/bin/env -S deno run -A
/**
 * Run a generated intEHRgrator `.xq` module under BaseX with JSON source binding.
 *
 * See docs/agents/xquery-engine-tests.md
 */
import { generate } from "@intehrgrator/core/codegen/mod.ts";
import type { MappingModel } from "@intehrgrator/types/mod.ts";

function parseCliArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = { help: false };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;
    if (token === "--help" || token === "-h") out.help = true;
    else if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("-")) {
        out[key] = next;
        i++;
      } else {
        out[key] = true;
      }
    }
  }
  return out;
}

function xqString(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** Minimal JSON → BaseX map/array literal for external variable binding. */
export function jsonToBasexMapExpr(value: unknown): string {
  if (value === null) return "()";
  if (typeof value === "boolean") return value ? "true()" : "false()";
  if (typeof value === "number") {
    return Number.isInteger(value) ? `${value}` : `xs:decimal("${value}")`;
  }
  if (typeof value === "string") return `"${value.replace(/"/g, '""')}"`;
  if (Array.isArray(value)) {
    const items = value.map((item) => jsonToBasexMapExpr(item)).join(", ");
    return `array { ${items} }`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, v]) => `${xqString(key)}: ${jsonToBasexMapExpr(v)}`)
      .join(", ");
    return `map { ${entries} }`;
  }
  return "()";
}

/** Bind JSON fixture values into generated module external variable declarations. */
export function bindXQueryExternals(
  xq: string,
  bindings: Record<string, string>,
): string {
  let result = xq;
  for (const [name, expr] of Object.entries(bindings)) {
    const typedDefault = new RegExp(
      `declare variable \\$${name} as map\\(\\*\\) external := map \\{\\};`,
    );
    const bareExternal = new RegExp(`declare variable \\$${name} external;`);
    if (typedDefault.test(result)) {
      result = result.replace(typedDefault, `declare variable $${name} as map(*) external := ${expr};`);
    } else if (bareExternal.test(result)) {
      result = result.replace(bareExternal, `declare variable $${name} external := ${expr};`);
    }
  }
  return result;
}

/** Convenience for tests: generate + run in one call when BaseX is available. */
export async function runGeneratedXQuery(
  model: MappingModel,
  jsonData: unknown,
  options: { defaults?: Record<string, unknown>; sheets?: Record<string, unknown> } = {},
): Promise<string> {
  const xq = generate(model, "xquery");
  const query = bindXQueryExternals(xq, {
    source: jsonToBasexMapExpr(jsonData),
    defaults: jsonToBasexMapExpr(options.defaults ?? {}),
    sheets: jsonToBasexMapExpr(options.sheets ?? {}),
  });

  const path = await Deno.makeTempFile({ suffix: ".xq" });
  try {
    await Deno.writeTextFile(path, query);
    const proc = new Deno.Command("basex", {
      args: [path],
      stdout: "piped",
      stderr: "piped",
    }).spawn();
    const { code, stdout, stderr } = await proc.output();
    const out = new TextDecoder().decode(stdout);
    const err = new TextDecoder().decode(stderr);
    if (code !== 0) throw new Error(err || out || `basex exited ${code}`);
    return out;
  } finally {
    await Deno.remove(path).catch(() => undefined);
  }
}

export async function basexAvailable(): Promise<boolean> {
  try {
    const proc = new Deno.Command("basex", { args: ["-V"], stdout: "null", stderr: "null" })
      .spawn();
    return (await proc.status).success;
  } catch {
    return false;
  }
}

if (import.meta.main) {
  const args = parseCliArgs(Deno.args);

  if (args.help || !args.xq) {
    console.log(`Usage: deno run -A scripts/run-xquery-basex.ts --xq mapping.xq --json source.json [--defaults d.json] [--sheets s.json] [--out result.xml]

Runs BaseX with external variables bound for intEHRgrator XQuery export modules.`);
    Deno.exit(args.help ? 0 : 1);
  }

  const xq = await Deno.readTextFile(String(args.xq));

  if (!args.json) {
    console.error("--json is required");
    Deno.exit(1);
  }
  const jsonData = JSON.parse(await Deno.readTextFile(String(args.json)));
  const defaults = args.defaults
    ? JSON.parse(await Deno.readTextFile(String(args.defaults)))
    : {};
  const sheets = args.sheets
    ? JSON.parse(await Deno.readTextFile(String(args.sheets)))
    : {};

  const query = bindXQueryExternals(xq, {
    source: jsonToBasexMapExpr(jsonData),
    defaults: jsonToBasexMapExpr(defaults),
    sheets: jsonToBasexMapExpr(sheets),
  });

  const tmp = await Deno.makeTempFile({ suffix: ".xq" });
  try {
    await Deno.writeTextFile(tmp, query);
    const proc = new Deno.Command("basex", {
      args: [tmp],
      stdout: "piped",
      stderr: "piped",
    }).spawn();
    const { code, stdout, stderr } = await proc.output();
    const out = new TextDecoder().decode(stdout);
    const err = new TextDecoder().decode(stderr);

    if (code !== 0) {
      console.error(err || out);
      Deno.exit(code || 1);
    }

    if (args.out) {
      await Deno.writeTextFile(String(args.out), out);
    } else {
      console.log(out);
    }
  } finally {
    await Deno.remove(tmp).catch(() => undefined);
  }
}
