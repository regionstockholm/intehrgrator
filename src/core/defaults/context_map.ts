/**
 * Default context map: runtime keys (convert-time) vs scaffold targets (authoring).
 * ADR 0011 / docs/design/default-context-map.md
 */

import { parseDefaultsPathKey } from "./points.ts";

export const DEFAULT_CONTEXT_MAP_TYPE = "default_context_map";
/** Unique canvas block type. Formerly a Defaults block with a plugged Map. */
export const DEFAULTS_BLOCK_TYPE = DEFAULT_CONTEXT_MAP_TYPE;
export const LEGACY_DEFAULTS_BLOCK_TYPE = "defaults_block";

export interface DefaultContextMapEntry {
  runtimeKey: string;
  scaffoldTargets: string[];
}

export interface DefaultContextMapEntryInfo extends DefaultContextMapEntry {
  index: number;
}

/** Well-known RM-path keys from the #157 factory → simple runtime keys. */
const LEGACY_PATH_TO_RUNTIME: Record<string, string> = {
  "*.language": "language",
  "COMPOSITION.territory": "territory",
  "*.encoding": "encoding",
  "*.start_time": "start_time",
  "*.origin": "origin",
  "*.time": "time",
  "COMPOSITION.composer": "composer",
  "EVENT_CONTEXT.health_care_facility": "facility",
  "*.subject": "subject",
};

const LEGACY_BARE_TO_RUNTIME: Record<string, string> = {
  composer_name: "composer",
  health_care_facility: "facility",
};

/** Canonical openEHR scaffold targets for well-known runtime keys. */
const RUNTIME_TO_TARGETS: Record<string, string[]> = {
  language: ["*.language"],
  territory: ["COMPOSITION.territory"],
  encoding: ["*.encoding"],
  start_time: ["*.start_time"],
  origin: ["*.origin"],
  time: ["*.time"],
  composer: ["COMPOSITION.composer"],
  facility: ["EVENT_CONTEXT.health_care_facility"],
  subject: ["*.subject"],
};

export function runtimeKeyFromLegacyKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return "";
  if (LEGACY_PATH_TO_RUNTIME[trimmed]) return LEGACY_PATH_TO_RUNTIME[trimmed];
  if (LEGACY_BARE_TO_RUNTIME[trimmed]) return LEGACY_BARE_TO_RUNTIME[trimmed];
  const parsed = parseDefaultsPathKey(trimmed);
  if (parsed) return parsed.attribute;
  return trimmed;
}

export function canonicalScaffoldTargets(runtimeKey: string): string[] {
  return RUNTIME_TO_TARGETS[runtimeKey.trim()] ?? [];
}

export function scaffoldTargetsFromLegacyKey(key: string): string[] {
  const trimmed = key.trim();
  if (!trimmed) return [];
  if (parseDefaultsPathKey(trimmed)) return [trimmed];
  return canonicalScaffoldTargets(runtimeKeyFromLegacyKey(trimmed));
}

export function wildcardScaffoldTarget(attribute: string): string {
  return `*.${attribute}`;
}

/** Class.attribute from a parent RM type + child attribute (chip from a tree drop). */
export function classAttributeScaffoldTarget(parentRmType: string, attribute: string): string {
  return `${parentRmType}.${attribute}`;
}

export function toggleScaffoldTargetWildcard(path: string): string {
  const trimmed = path.trim();
  const parsed = parseDefaultsPathKey(trimmed);
  if (!parsed) return trimmed;
  if (parsed.parts.length >= 2 && parsed.parts[0] === "*") {
    return trimmed;
  }
  return wildcardScaffoldTarget(parsed.attribute);
}

/** Each path is one entry: runtime key is the last segment, scaffold target is the path. */
export function entriesFromScaffoldTargetList(
  targets: readonly string[],
): DefaultContextMapEntry[] {
  return targets.map((target) => ({
    runtimeKey: runtimeKeyFromLegacyKey(target) || target,
    scaffoldTargets: parseDefaultsPathKey(target) ? [target] : [],
  }));
}

export function runtimeKeyWarnings(entries: readonly DefaultContextMapEntry[]): string[] {
  const messages: string[] = [];
  const seen = new Map<string, number>();
  for (const entry of entries) {
    const key = entry.runtimeKey.trim();
    if (!key) {
      messages.push("Empty runtime key is invalid");
      continue;
    }
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
  }
  for (const [key, count] of seen) {
    if (count > 1) {
      messages.push(`Duplicate runtime key “${key}” (UNIQUE)`);
    }
  }
  return messages;
}

interface BlocklyBlockJson {
  type?: string;
  id?: string;
  x?: number;
  y?: number;
  fields?: Record<string, unknown>;
  extraState?: { itemCount?: number; targets?: string[][] };
  inputs?: Record<string, { block?: BlocklyBlockJson; shadow?: BlocklyBlockJson }>;
  next?: { block?: BlocklyBlockJson };
}

/**
 * Convert a `maps_create_with` (legacy Defaults Map) into a unique
 * `default_context_map` block JSON. One-way ingest — convert-time bags only
 * ever see runtime keys after this.
 */
export function mapsCreateWithToContextMap(block: unknown): Record<string, unknown> | null {
  if (!block || typeof block !== "object") return null;
  const rec = block as BlocklyBlockJson;
  if (rec.type === DEFAULT_CONTEXT_MAP_TYPE) {
    return structuredClone(rec) as Record<string, unknown>;
  }
  if (rec.type !== "maps_create_with") return null;
  const count = itemCount(rec);
  const fields: Record<string, unknown> = {};
  const targets: string[][] = [];
  for (let i = 0; i < count; i++) {
    const legacy = String(rec.fields?.[`KEY${i}`] ?? "").trim();
    const runtimeKey = runtimeKeyFromLegacyKey(legacy);
    const chips = scaffoldTargetsFromLegacyKey(legacy);
    fields[`KEY${i}`] = runtimeKey;
    fields[`TARGETS${i}`] = JSON.stringify(chips);
    targets.push(chips);
  }
  const out: BlocklyBlockJson = {
    type: DEFAULT_CONTEXT_MAP_TYPE,
    extraState: { itemCount: count, targets },
    fields,
    inputs: rec.inputs ? structuredClone(rec.inputs) : {},
  };
  if (rec.id) out.id = rec.id;
  if (typeof rec.x === "number") out.x = rec.x;
  if (typeof rec.y === "number") out.y = rec.y;
  return out as Record<string, unknown>;
}

export function contextMapFromDefaultsJson(parsed: unknown): Record<string, unknown> | null {
  if (!parsed || typeof parsed !== "object") return null;
  const rec = parsed as BlocklyBlockJson & { blocks?: { blocks?: BlocklyBlockJson[] } };
  if (rec.type === DEFAULT_CONTEXT_MAP_TYPE) {
    return structuredClone(rec) as Record<string, unknown>;
  }
  if (rec.type === "maps_create_with") {
    return mapsCreateWithToContextMap(rec);
  }
  if (rec.type === LEGACY_DEFAULTS_BLOCK_TYPE) {
    const inner = rec.inputs?.MAP?.block ?? rec.inputs?.MAP?.shadow;
    const converted = mapsCreateWithToContextMap(inner);
    if (!converted) return null;
    if (typeof rec.x === "number") converted.x = rec.x;
    if (typeof rec.y === "number") converted.y = rec.y;
    return converted;
  }
  const blocks = rec.blocks?.blocks;
  if (Array.isArray(blocks)) {
    const unique = blocks.find((block) => block.type === DEFAULT_CONTEXT_MAP_TYPE);
    if (unique) return structuredClone(unique) as Record<string, unknown>;
    const legacy = blocks.find((block) => block.type === LEGACY_DEFAULTS_BLOCK_TYPE);
    if (legacy) {
      const inner = legacy.inputs?.MAP?.block ?? legacy.inputs?.MAP?.shadow;
      return mapsCreateWithToContextMap(inner);
    }
    const map = blocks.find((block) => block.type === "maps_create_with");
    if (map) return mapsCreateWithToContextMap(map);
  }
  return contextMapFromPlainRecord(parsed);
}

function contextMapFromPlainRecord(parsed: unknown): Record<string, unknown> | null {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const rec = parsed as Record<string, unknown>;
  if ("type" in rec || "blocks" in rec) return null;
  const entries = Object.entries(rec);
  if (!entries.length) return null;
  if (
    !entries.every(([, value]) =>
      value == null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    )
  ) {
    return null;
  }
  const fields: Record<string, unknown> = {};
  const inputs: NonNullable<BlocklyBlockJson["inputs"]> = {};
  const targets: string[][] = [];
  entries.forEach(([key, value], i) => {
    fields[`KEY${i}`] = runtimeKeyFromLegacyKey(key);
    const chips = scaffoldTargetsFromLegacyKey(key);
    fields[`TARGETS${i}`] = JSON.stringify(chips);
    targets.push(chips);
    inputs[`VAL${i}`] = { block: literalBlock(value) };
  });
  return {
    type: DEFAULT_CONTEXT_MAP_TYPE,
    extraState: { itemCount: entries.length, targets },
    fields,
    inputs,
  };
}

function literalBlock(value: unknown): BlocklyBlockJson {
  if (typeof value === "number") {
    return { type: "math_number", fields: { NUM: value } };
  }
  if (typeof value === "boolean") {
    return { type: "logic_boolean", fields: { BOOL: value ? "TRUE" : "FALSE" } };
  }
  return { type: "text", fields: { TEXT: String(value ?? "") } };
}

export function entriesFromContextMapBlock(block: unknown): DefaultContextMapEntryInfo[] {
  if (!block || typeof block !== "object") return [];
  const rec = block as BlocklyBlockJson;
  if (rec.type !== DEFAULT_CONTEXT_MAP_TYPE && rec.type !== "maps_create_with") {
    return [];
  }
  const source = rec.type === "maps_create_with"
    ? mapsCreateWithToContextMap(rec) as BlocklyBlockJson | null
    : rec;
  if (!source) return [];
  const count = itemCount(source);
  const extraTargets = source.extraState?.targets;
  const entries: DefaultContextMapEntryInfo[] = [];
  for (let i = 0; i < count; i++) {
    const runtimeKey = String(source.fields?.[`KEY${i}`] ?? "").trim();
    const fromField = parseTargetsField(source.fields?.[`TARGETS${i}`]);
    const fromExtra = Array.isArray(extraTargets?.[i]) ? extraTargets[i]! : [];
    const scaffoldTargets = fromField.length ? fromField : fromExtra;
    entries.push({ runtimeKey, scaffoldTargets, index: i });
  }
  return entries;
}

export function parseTargetsField(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim() !== "")
      .map((item) => item.trim());
  }
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string" && item.trim() !== "")
      .map((item) => item.trim());
  } catch {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
}

export function isEmptyContextMapState(state: unknown): boolean {
  if (!state || typeof state !== "object") return true;
  const rec = state as BlocklyBlockJson;
  if (rec.type && rec.type !== DEFAULT_CONTEXT_MAP_TYPE && rec.type !== "maps_create_with") {
    if (rec.type === LEGACY_DEFAULTS_BLOCK_TYPE) {
      const inner = rec.inputs?.MAP?.block ?? rec.inputs?.MAP?.shadow;
      return isEmptyContextMapState(inner);
    }
    return false;
  }
  return itemCount(rec) === 0;
}

function itemCount(block: BlocklyBlockJson): number {
  const extra = Number(block.extraState?.itemCount ?? 0);
  const fieldKeys = Object.keys(block.fields ?? {}).filter((name) => /^KEY\d+$/.test(name));
  const valKeys = Object.keys(block.inputs ?? {}).filter((name) => /^VAL\d+$/.test(name));
  const fromNames = (names: string[]) =>
    names.length ? Math.max(...names.map((name) => Number(name.replace(/^\D+/, "")))) + 1 : 0;
  return Math.max(extra, fromNames(fieldKeys), fromNames(valKeys));
}

/**
 * Rewrite workspace JSON: unique default context map + maps_get runtime keys.
 * One-way; not a convert-time dual-read.
 */
export function migrateDefaultContextMapState<T>(state: T): T {
  if (!state || typeof state !== "object") return state;
  const clone = structuredClone(state) as Record<string, unknown>;
  const remap = new Map<string, string>();
  const blocks = workspaceTopBlocks(clone);
  if (blocks) {
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i]!;
      if (block.type === LEGACY_DEFAULTS_BLOCK_TYPE) {
        const inner = block.inputs?.MAP?.block ?? block.inputs?.MAP?.shadow;
        collectLegacyRemap(inner, remap);
        const converted = mapsCreateWithToContextMap(inner);
        if (converted) {
          if (typeof block.x === "number") converted.x = block.x;
          if (typeof block.y === "number") converted.y = block.y;
          if (block.id) converted.id = block.id;
          blocks[i] = converted as BlocklyBlockJson;
        }
      } else if (block.type === DEFAULT_CONTEXT_MAP_TYPE) {
        collectContextRemap(block, remap);
      } else if (block.type === "maps_create_with") {
        // Leave generic Maps alone.
      }
    }
  }
  rewriteMapsGetKeys(clone, remap);
  return clone as T;
}

function workspaceTopBlocks(state: Record<string, unknown>): BlocklyBlockJson[] | null {
  const blocks = (state as { blocks?: { blocks?: BlocklyBlockJson[] } }).blocks?.blocks;
  return Array.isArray(blocks) ? blocks : null;
}

function collectLegacyRemap(block: BlocklyBlockJson | undefined, remap: Map<string, string>): void {
  if (!block || block.type !== "maps_create_with") return;
  const count = itemCount(block);
  for (let i = 0; i < count; i++) {
    const legacy = String(block.fields?.[`KEY${i}`] ?? "").trim();
    if (!legacy) continue;
    remap.set(legacy, runtimeKeyFromLegacyKey(legacy));
  }
}

function collectContextRemap(block: BlocklyBlockJson, remap: Map<string, string>): void {
  const count = itemCount(block);
  const extraTargets = block.extraState?.targets;
  for (let i = 0; i < count; i++) {
    const runtimeKey = String(block.fields?.[`KEY${i}`] ?? "").trim();
    if (!runtimeKey) continue;
    const chips = parseTargetsField(block.fields?.[`TARGETS${i}`]);
    const extra = Array.isArray(extraTargets?.[i]) ? extraTargets[i]! : [];
    for (const chip of chips.length ? chips : extra) {
      remap.set(chip, runtimeKey);
    }
  }
}

function rewriteMapsGetKeys(node: unknown, remap: Map<string, string>): void {
  if (Array.isArray(node)) {
    for (const item of node) rewriteMapsGetKeys(item, remap);
    return;
  }
  if (!node || typeof node !== "object") return;
  const rec = node as BlocklyBlockJson;
  if (rec.type === "maps_get") {
    const name = String(rec.fields?.NAME ?? "defaults");
    if (name === "defaults") {
      const keyNode = rec.inputs?.KEY?.block ?? rec.inputs?.KEY?.shadow;
      if (keyNode?.type === "text") {
        const fields = (keyNode.fields ?? {}) as Record<string, unknown>;
        const current = String(fields.TEXT ?? "");
        const next = remap.get(current);
        if (next) fields.TEXT = next;
        keyNode.fields = fields;
      }
    }
  }
  for (const value of Object.values(rec)) rewriteMapsGetKeys(value, remap);
}
