/**
 * Optional BaseX (or compatible) runner for generated XQuery Conversion Scripts.
 *
 * Generated `.xq` stays engine-portable (XQuery 3.1 + `parse-json` / maps).
 * This module only materializes `$source` / `$defaults` / `$sheets` and shells
 * out to BaseX when it is installed. Missing engine → skip, never fail CI.
 *
 * See docs/XQUERY_ENGINE.md.
 */
import { join } from "@std/path";

export interface XQueryEngineBindings {
  source: unknown;
  defaults?: unknown;
  sheets?: unknown;
}

export interface XQueryEngineResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

export function findBasexExecutable(): string | null {
  const fromEnv = Deno.env.get("BASEX_BIN")?.trim();
  if (fromEnv) return fromEnv;
  const homes = [
    Deno.env.get("BASEX_HOME")?.trim(),
    Deno.env.get("HOME") ? join(Deno.env.get("HOME")!, "basex") : undefined,
  ];
  for (const home of homes) {
    if (!home) continue;
    const candidate = join(home, "bin", "basex");
    if (isFile(candidate)) return candidate;
  }
  return lookupOnPath("basex");
}

function isFile(path: string): boolean {
  try {
    return Deno.statSync(path).isFile;
  } catch {
    return false;
  }
}

function lookupOnPath(name: string): string | null {
  const path = Deno.env.get("PATH") ?? "";
  for (const dir of path.split(":")) {
    if (!dir) continue;
    const candidate = join(dir, name);
    if (isFile(candidate)) return candidate;
  }
  return null;
}

/** Rewrite `declare variable $x external` to `parse-json(unparsed-text(...))` (XPath 3.1). */
export function materializeXQueryExternals(
  script: string,
  files: { sourceUri: string; defaultsUri?: string; sheetsUri?: string },
): string {
  const parse = (uri: string) => `parse-json(unparsed-text(${xqHref(uri)}))`;
  let out = script.replace(
    /declare variable \$source external;/,
    `declare variable $source := ${parse(files.sourceUri)};`,
  );
  out = out.replace(
    /declare variable \$defaults as map\(\*\) external := map \{\};/,
    files.defaultsUri
      ? `declare variable $defaults as map(*) := ${parse(files.defaultsUri)};`
      : "declare variable $defaults as map(*) := map {};",
  );
  out = out.replace(
    /declare variable \$sheets as map\(\*\) external := map \{\};/,
    files.sheetsUri
      ? `declare variable $sheets as map(*) := ${parse(files.sheetsUri)};`
      : "declare variable $sheets as map(*) := map {};",
  );
  return out;
}

function xqHref(uri: string): string {
  return `"${uri.replace(/"/g, '""')}"`;
}

export function fileUriFromPath(absPath: string): string {
  const normalized = absPath.replaceAll("\\", "/");
  return normalized.startsWith("file:") ? normalized : `file://${normalized}`;
}

export async function runXQueryOnBasex(
  script: string,
  bindings: XQueryEngineBindings,
  options: { basex?: string; workDir?: string } = {},
): Promise<XQueryEngineResult> {
  const basex = options.basex ?? findBasexExecutable();
  if (!basex) {
    throw new Error("BaseX executable not found (set BASEX_HOME or BASEX_BIN)");
  }
  const workDir = options.workDir ?? Deno.makeTempDirSync({ prefix: "intehr-xq-" });
  const sourcePath = join(workDir, "source.json");
  const scriptPath = join(workDir, "convert.xq");
  await Deno.writeTextFile(sourcePath, JSON.stringify(bindings.source ?? {}));
  const files: { sourceUri: string; defaultsUri?: string; sheetsUri?: string } = {
    sourceUri: fileUriFromPath(sourcePath),
  };
  if (bindings.defaults !== undefined) {
    const defaultsPath = join(workDir, "defaults.json");
    await Deno.writeTextFile(defaultsPath, JSON.stringify(bindings.defaults));
    files.defaultsUri = fileUriFromPath(defaultsPath);
  }
  if (bindings.sheets !== undefined) {
    const sheetsPath = join(workDir, "sheets.json");
    await Deno.writeTextFile(sheetsPath, JSON.stringify(bindings.sheets));
    files.sheetsUri = fileUriFromPath(sheetsPath);
  }
  const materialized = materializeXQueryExternals(script, files);
  await Deno.writeTextFile(scriptPath, materialized);
  const command = new Deno.Command(basex, {
    args: ["-Q", scriptPath],
    stdout: "piped",
    stderr: "piped",
  });
  const result = await command.output();
  return {
    ok: result.success,
    stdout: new TextDecoder().decode(result.stdout),
    stderr: new TextDecoder().decode(result.stderr),
  };
}
