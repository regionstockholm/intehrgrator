import { DEFAULTS_MAP_NAME } from "./factory.ts";
export { DEFAULTS_MAP_NAME };

export const DEFAULTS_BLOCK_TYPE = "defaults_block";
export const MAPS_CREATE_WITH = "maps_create_with";
export const MAPS_GET = "maps_get";

export type NamedMaps = Record<string, Record<string, unknown>>;

interface BlocklyBlockJson {
  type?: string;
  fields?: Record<string, unknown>;
  extraState?: { itemCount?: number; keys?: string[] };
  inputs?: Record<string, { block?: BlocklyBlockJson; shadow?: BlocklyBlockJson }>;
  next?: { block?: BlocklyBlockJson };
}

interface BlocklyWorkspaceJson {
  blocks?: { blocks?: BlocklyBlockJson[] };
}

/**
 * Materialize named Maps from Blockly workspace JSON.
 * Literal text/number/boolean values are used as-is; other value blocks become null.
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
  const rec = migrateBlocklyMapsJson(parsed) as BlocklyBlockJson & BlocklyWorkspaceJson;
  if (rec.type === MAPS_CREATE_WITH) return rec;
  if (rec.type === DEFAULTS_BLOCK_TYPE) {
    return rec.inputs?.MAP?.block ?? rec.inputs?.MAP?.shadow ?? null;
  }
  const blocks = rec.blocks?.blocks;
  if (!Array.isArray(blocks)) return null;
  const defaults = blocks.find((block) => block.type === DEFAULTS_BLOCK_TYPE);
  const fromDefaults = defaults?.inputs?.MAP?.block ?? defaults?.inputs?.MAP?.shadow;
  if (fromDefaults) return fromDefaults;
  return blocks.find((block) => block.type === MAPS_CREATE_WITH) ?? null;
}

/**
 * Rewrite stacked KEY/VAL sockets (and maps_get KEY sockets) into compact fields.
 * Returns a JSON clone so catalog / project objects are left unchanged.
 */
export function migrateBlocklyMapsJson<T>(state: T): T {
  if (!state || typeof state !== "object") return state;
  const rec = JSON.parse(JSON.stringify(state)) as BlocklyWorkspaceJson & BlocklyBlockJson;
  if (Array.isArray(rec.blocks?.blocks)) {
    for (const block of rec.blocks.blocks) walkMigrate(block);
  }
  walkMigrate(rec);
  return rec as T;
}

function walkMigrate(block: BlocklyBlockJson | undefined): void {
  if (!block || typeof block !== "object") return;
  if (block.type === MAPS_CREATE_WITH) migrateMapsCreateWith(block);
  if (block.type === MAPS_GET) migrateMapsGet(block);
  for (const input of Object.values(block.inputs ?? {})) {
    walkMigrate(input.block);
    walkMigrate(input.shadow);
  }
  walkMigrate(block.next?.block);
}

function migrateMapsCreateWith(block: BlocklyBlockJson): BlocklyBlockJson {
  if (!block.inputs && !block.fields && !block.extraState) return block;
  const count = mapItemCount(block);
  const keys: string[] = Array.isArray(block.extraState?.keys)
    ? [...block.extraState.keys]
    : [];
  for (let i = 0; i < count; i++) {
    const fromField = block.fields?.[`KEY${i}`];
    const key = (typeof fromField === "string" && fromField) ||
      keys[i] ||
      (typeof literalFromInput(block.inputs?.[`KEY${i}`]) === "string"
        ? String(literalFromInput(block.inputs?.[`KEY${i}`]))
        : "");
    if (key) {
      block.fields ??= {};
      block.fields[`KEY${i}`] = key;
    }
    keys[i] = key;
    if (block.inputs) delete block.inputs[`KEY${i}`];
  }
  block.extraState = {
    itemCount: count,
    keys,
  };
  return block;
}

function migrateMapsGet(block: BlocklyBlockJson): void {
  const fromField = block.fields?.KEY;
  if (typeof fromField === "string" && fromField) return;
  const fromInput = literalFromInput(block.inputs?.KEY);
  if (typeof fromInput !== "string") return;
  block.fields = { ...block.fields, KEY: fromInput };
  if (block.inputs) delete block.inputs.KEY;
}

function topBlocks(state: unknown): BlocklyBlockJson[] {
  if (!state || typeof state !== "object") return [];
  const blocks = (state as BlocklyWorkspaceJson).blocks?.blocks;
  return Array.isArray(blocks) ? blocks : [];
}

function mapItemCount(block: BlocklyBlockJson): number {
  const inputKeys = Object.keys(block.inputs ?? {}).filter((name) =>
    /^KEY\d+$/.test(name) || /^VAL\d+$/.test(name)
  );
  const fieldKeys = Object.keys(block.fields ?? {}).filter((name) => /^KEY\d+$/.test(name));
  const extraKeys = block.extraState?.keys?.length ?? 0;
  const fromInputs = inputKeys.length
    ? Math.max(...inputKeys.map((name) => Number(name.replace(/^(KEY|VAL)/, "")))) + 1
    : 0;
  const fromFields = fieldKeys.length
    ? Math.max(...fieldKeys.map((name) => Number(name.slice(3)))) + 1
    : 0;
  return Math.max(Number(block.extraState?.itemCount ?? 0), fromInputs, fromFields, extraKeys);
}

function mapFromCreateWith(block: BlocklyBlockJson | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!block || block.type !== MAPS_CREATE_WITH) return out;
  const count = mapItemCount(block);
  for (let i = 0; i < count; i++) {
    const key = keyAt(block, i);
    if (!key) continue;
    out[key] = literalFromInput(block.inputs?.[`VAL${i}`]) ?? "";
  }
  return out;
}

function keyAt(block: BlocklyBlockJson, i: number): string {
  const fromField = block.fields?.[`KEY${i}`];
  if (typeof fromField === "string" && fromField) return fromField;
  const fromExtra = block.extraState?.keys?.[i];
  if (typeof fromExtra === "string" && fromExtra) return fromExtra;
  const fromInput = literalFromInput(block.inputs?.[`KEY${i}`]);
  return typeof fromInput === "string" ? fromInput : "";
}

function literalFromInput(
  input: { block?: BlocklyBlockJson; shadow?: BlocklyBlockJson } | undefined,
): unknown {
  const block = input?.block ?? input?.shadow;
  if (!block) return "";
  if (block.type === "text") return String(block.fields?.TEXT ?? "");
  if (block.type === "math_number") return Number(block.fields?.NUM ?? 0);
  if (block.type === "logic_boolean") return block.fields?.BOOL === "TRUE";
  return null;
}
