import { DEFAULTS_MAP_NAME } from "./factory.ts";
import { TERM_PICK_NONE } from "../openehr_term_catalog.ts";
export { DEFAULTS_MAP_NAME };

export const DEFAULTS_BLOCK_TYPE = "defaults_block";
export const MAPS_CREATE_WITH = "maps_create_with";
export const MAPS_GET = "maps_get";

export type NamedMaps = Record<string, Record<string, unknown>>;

interface BlocklyBlockJson {
  type?: string;
  fields?: Record<string, unknown>;
  extraState?: { itemCount?: number };
  inputs?: Record<string, { block?: BlocklyBlockJson; shadow?: BlocklyBlockJson }>;
  next?: { block?: BlocklyBlockJson };
}

interface BlocklyWorkspaceJson {
  blocks?: { blocks?: BlocklyBlockJson[] };
}

/**
 * Materialize named Maps from Blockly workspace JSON.
 * Literal text/number/boolean values are used as-is; term_pick contributes
 * its selected code; other value blocks become null.
 */
export function namedMapsFromBlocklyState(state: unknown): NamedMaps {
  const maps: NamedMaps = {};
  const blocks = topBlocks(state);
  for (const block of blocks) {
    if (block.type === DEFAULTS_BLOCK_TYPE) {
      const mapBlock = block.inputs?.MAP?.block ?? block.inputs?.MAP?.shadow;
      maps[DEFAULTS_MAP_NAME] = mapFromCreateWith(mapBlock);
    }
    if (block.type === MAPS_CREATE_WITH) {
      const name = String(block.fields?.NAME ?? "").trim();
      if (name && name !== DEFAULTS_MAP_NAME) {
        maps[name] = mapFromCreateWith(block);
      }
    }
  }
  return maps;
}

export function mapsGetExpression(mapName: string, key: string): string {
  return `maps_get(${JSON.stringify(mapName)}, ${JSON.stringify(key)})`;
}

/**
 * Accept a `maps_create_with` block JSON, or a workspace / Defaults block that wraps one.
 */
export function mapBlockFromDefaultsJson(parsed: unknown): unknown | null {
  if (!parsed || typeof parsed !== "object") return null;
  migrateMapsCreateWithJson(parsed);
  const rec = parsed as BlocklyBlockJson & BlocklyWorkspaceJson;
  if (rec.type === MAPS_CREATE_WITH) return parsed;
  if (rec.type === DEFAULTS_BLOCK_TYPE) {
    return rec.inputs?.MAP?.block ?? rec.inputs?.MAP?.shadow ?? null;
  }
  const blocks = rec.blocks?.blocks;
  if (Array.isArray(blocks)) {
    const defaults = blocks.find((block) => block.type === DEFAULTS_BLOCK_TYPE);
    const fromDefaults = defaults?.inputs?.MAP?.block ?? defaults?.inputs?.MAP?.shadow;
    if (fromDefaults) return fromDefaults;
    const map = blocks.find((block) => block.type === MAPS_CREATE_WITH);
    if (map) return map;
  }
  return mapsCreateWithFromPlainRecord(parsed);
}

function mapsCreateWithFromPlainRecord(parsed: unknown): BlocklyBlockJson | null {
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
  entries.forEach(([key, value], i) => {
    fields[`KEY${i}`] = key;
    inputs[`VAL${i}`] = { block: literalBlock(value) };
  });
  return {
    type: MAPS_CREATE_WITH,
    extraState: { itemCount: entries.length },
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

/**
 * Rewrite legacy `maps_create_with` JSON that stored keys as `KEY{n}` value
 * inputs (nested `text` blocks) into `fields.KEY{n}` plus `VAL{n}` sockets.
 * Safe to call on full workspace JSON, a Defaults block, or a map block.
 */
export function migrateMapsCreateWithJson<T>(state: T): T {
  walkMigrate(state);
  return state;
}

function walkMigrate(node: unknown): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) walkMigrate(item);
    return;
  }
  const rec = node as BlocklyBlockJson & BlocklyWorkspaceJson & {
    block?: unknown;
    shadow?: unknown;
  };
  if (rec.type === MAPS_CREATE_WITH) migrateOneMapCreateWith(rec);
  if (rec.inputs) walkMigrate(rec.inputs);
  if (rec.next) walkMigrate(rec.next);
  if (rec.blocks) walkMigrate(rec.blocks);
  if (rec.block) walkMigrate(rec.block);
  if (rec.shadow) walkMigrate(rec.shadow);
}

function migrateOneMapCreateWith(block: BlocklyBlockJson): void {
  const inputs = block.inputs;
  if (!inputs) return;
  const fields = block.fields ?? (block.fields = {});
  for (const name of Object.keys(inputs)) {
    if (/^ROW\d+$/.test(name) || name === "HEADER_END") {
      delete inputs[name];
      continue;
    }
    const match = /^KEY(\d+)$/.exec(name);
    if (!match) continue;
    const fieldName = `KEY${match[1]}`;
    if (fields[fieldName] == null || fields[fieldName] === "") {
      const lit = literalFromInput(inputs[name]);
      if (typeof lit === "string" || typeof lit === "number" || typeof lit === "boolean") {
        fields[fieldName] = String(lit);
      }
    }
    delete inputs[name];
  }
}

function topBlocks(state: unknown): BlocklyBlockJson[] {
  if (!state || typeof state !== "object") return [];
  const blocks = (state as BlocklyWorkspaceJson).blocks?.blocks;
  return Array.isArray(blocks) ? blocks : [];
}

function mapFromCreateWith(block: BlocklyBlockJson | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!block || block.type !== MAPS_CREATE_WITH) return out;
  const fieldKeys = Object.keys(block.fields ?? {}).filter((name) => /^KEY\d+$/.test(name));
  const valKeys = Object.keys(block.inputs ?? {}).filter((name) => /^VAL\d+$/.test(name));
  const inputKeys = Object.keys(block.inputs ?? {}).filter((name) => /^KEY\d+$/.test(name));
  const fromNames = (names: string[]) =>
    names.length ? Math.max(...names.map((name) => Number(name.slice(3)))) + 1 : 0;
  const count = Math.max(
    Number(block.extraState?.itemCount ?? 0),
    fromNames(fieldKeys),
    fromNames(valKeys),
    fromNames(inputKeys),
  );
  for (let i = 0; i < count; i++) {
    const key = keyFromPair(block, i);
    if (typeof key !== "string" || !key) continue;
    out[key] = literalFromInput(block.inputs?.[`VAL${i}`]) ?? "";
  }
  return out;
}

function keyFromPair(block: BlocklyBlockJson, index: number): unknown {
  const fromField = block.fields?.[`KEY${index}`];
  if (typeof fromField === "string" && fromField) return fromField;
  if (typeof fromField === "number" || typeof fromField === "boolean") {
    return String(fromField);
  }
  return literalFromInput(block.inputs?.[`KEY${index}`]);
}

function literalFromInput(
  input: { block?: BlocklyBlockJson; shadow?: BlocklyBlockJson } | undefined,
): unknown {
  const block = input?.block ?? input?.shadow;
  if (!block) return "";
  if (block.type === "text") return String(block.fields?.TEXT ?? "");
  if (block.type === "math_number") return Number(block.fields?.NUM ?? 0);
  if (block.type === "logic_boolean") return block.fields?.BOOL === "TRUE";
  if (block.type === "term_pick") {
    const code = String(block.fields?.CODE ?? "");
    return !code || code === TERM_PICK_NONE ? "" : code;
  }
  return null;
}
