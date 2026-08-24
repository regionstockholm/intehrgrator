import { DEFAULTS_MAP_NAME } from "./factory.ts";
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
  const rec = parsed as BlocklyBlockJson & BlocklyWorkspaceJson;
  if (rec.type === MAPS_CREATE_WITH) return parsed;
  if (rec.type === DEFAULTS_BLOCK_TYPE) {
    return rec.inputs?.MAP?.block ?? rec.inputs?.MAP?.shadow ?? null;
  }
  const blocks = rec.blocks?.blocks;
  if (!Array.isArray(blocks)) return null;
  const defaults = blocks.find((block) => block.type === DEFAULTS_BLOCK_TYPE);
  const fromDefaults = defaults?.inputs?.MAP?.block ?? defaults?.inputs?.MAP?.shadow;
  if (fromDefaults) return fromDefaults;
  const map = blocks.find((block) => block.type === MAPS_CREATE_WITH);
  return map ?? null;
}

function topBlocks(state: unknown): BlocklyBlockJson[] {
  if (!state || typeof state !== "object") return [];
  const blocks = (state as BlocklyWorkspaceJson).blocks?.blocks;
  return Array.isArray(blocks) ? blocks : [];
}

function mapFromCreateWith(block: BlocklyBlockJson | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!block || block.type !== MAPS_CREATE_WITH) return out;
  const inputKeys = Object.keys(block.inputs ?? {}).filter((name) => /^KEY\d+$/.test(name));
  const count = Math.max(
    Number(block.extraState?.itemCount ?? 0),
    inputKeys.length ? Math.max(...inputKeys.map((name) => Number(name.slice(3)))) + 1 : 0,
  );
  for (let i = 0; i < count; i++) {
    const key = literalFromInput(block.inputs?.[`KEY${i}`]);
    if (typeof key !== "string" || !key) continue;
    out[key] = literalFromInput(block.inputs?.[`VAL${i}`]) ?? "";
  }
  return out;
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
