/**
 * One-way ingest: rewrite in-repo defaults / mapping Blockly JSON to the unique
 * default context map (runtime keys + scaffold-target chips).
 *
 * Only touches defaults.map.json, *.blockly.json, and the bundled factory map.
 */
import { walk } from "@std/fs/walk";
import { basename, join } from "@std/path";
import {
  contextMapFromDefaultsJson,
  migrateDefaultContextMapState,
} from "../src/core/defaults/context_map.ts";

const root = join(import.meta.dirname!, "..");

function looksLikeWorkspace(value: unknown): value is { blocks: { blocks: unknown[] } } {
  if (!value || typeof value !== "object") return false;
  const rec = value as { blocks?: { blocks?: unknown } };
  return Array.isArray(rec.blocks?.blocks);
}

function looksLikeMapBlock(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const rec = value as { type?: string };
  return rec.type === "maps_create_with" || rec.type === "defaults_block" ||
    rec.type === "default_context_map";
}

function looksLikePlainDefaults(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const rec = value as Record<string, unknown>;
  if ("type" in rec || "blocks" in rec) return false;
  const entries = Object.entries(rec);
  return entries.length > 0 && entries.every(([, v]) =>
    v == null || typeof v === "string" || typeof v === "number" || typeof v === "boolean"
  );
}

function shouldConvert(path: string): boolean {
  const name = basename(path);
  if (name === "defaults_openEHR_1.map.json") return true;
  if (name === "defaults.map.json") return true;
  if (name.endsWith(".blockly.json")) return true;
  return false;
}

let changed = 0;
for await (
  const entry of walk(root, {
    includeDirs: false,
    exts: [".json"],
    skip: [/\/vendor\//, /\/node_modules\//, /\/\.git\//],
  })
) {
  const path = entry.path;
  if (!shouldConvert(path)) continue;
  const text = await Deno.readTextFile(path);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    continue;
  }
  let next: unknown = parsed;
  if (looksLikeWorkspace(parsed)) {
    next = migrateDefaultContextMapState(parsed);
  } else if (looksLikeMapBlock(parsed) || looksLikePlainDefaults(parsed)) {
    next = contextMapFromDefaultsJson(parsed) ?? parsed;
  } else {
    continue;
  }
  const out = `${JSON.stringify(next, null, 2)}\n`;
  if (out !== text) {
    await Deno.writeTextFile(path, out);
    changed++;
    console.log("converted", path.slice(root.length + 1));
  }
}
console.log(`rewrote ${changed} files`);
