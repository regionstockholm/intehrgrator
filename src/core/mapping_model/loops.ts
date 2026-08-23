import type { MappingLoop, MappingModel } from "../../types/mod.ts";

/**
 * When a source path addresses one array item (`$.measurements[1].pulse`)
 * and the target ancestor is repeatable, record a loop over that array and
 * store a path relative to the current node (`pulse`) so Blockly
 * `for_each_source` can iterate a variable number of source nodes.
 */
export function promoteIndexedSourcePath(path: string): {
  loopPath: string;
  mappedPath: string;
  varName: string;
} | null {
  const json = /^(\$\.[^[]+)\[(\d+|\*)\](.*)$/.exec(path.trim());
  if (json) {
    const loopPath = json[1]!;
    const rest = json[3] ?? "";
    const mappedPath = `${loopPath}[*]${rest}`;
    const varName = loopPath.split(/[./]/).filter(Boolean).pop() ?? "item";
    return { loopPath, mappedPath, varName };
  }
  return null;
}

/** Child steps of a `[*]` path, relative to the loop node (`pulse`, `.`, …). */
export function relativePathFromLoop(mappedPath: string, loopPath: string): string {
  const base = loopPath.replace(/\[\*\]$/, "");
  const prefix = `${base}[*]`;
  if (mappedPath === prefix) return ".";
  if (mappedPath.startsWith(`${prefix}.`)) return mappedPath.slice(prefix.length + 1);
  if (mappedPath.startsWith(`${prefix}/`)) return mappedPath.slice(prefix.length + 1);
  return mappedPath;
}

export function isRelativeAuthoringPath(path: string): boolean {
  const trimmed = path.trim();
  return trimmed.length > 0 && !trimmed.startsWith("$") && !trimmed.startsWith("/");
}

/** True when every `xpath*` path in the expression is relative to a loop node. */
export function expressionUsesRelativeSourcePath(expression: string): boolean {
  const matches = [...expression.matchAll(/xpath(?:String|Number|Boolean)?\("([^"]*)"\)/g)];
  if (!matches.length) return false;
  return matches.every((match) => isRelativeAuthoringPath(match[1]!));
}

export function upsertLoop(model: MappingModel, loop: MappingLoop): MappingModel {
  const loops = [...(model.loops ?? [])];
  const idx = loops.findIndex((item) => item.attachSlotId === loop.attachSlotId);
  if (idx >= 0) loops[idx] = loop;
  else loops.push(loop);
  return { ...model, loops };
}
