/**
 * Hardcode (inline) a Defaults Map entry: replace canvas `maps_get("defaults", key)`
 * lookups with a copy of that map entry's value block.
 */
import type { Workspace } from "blockly/core";
import { Blockly } from "./blockly_core.ts";
import {
  DEFAULTS_BLOCK_TYPE,
  DEFAULTS_MAP_NAME,
  MAPS_GET,
} from "../core/defaults/extract.ts";

export interface DefaultsMapEntryInfo {
  key: string;
  index: number;
  /** Short summary of the plugged-in value for the hardcode picker. */
  summary: string;
}

/** Keys currently present on the Defaults Map plugged into the Defaults block. */
export function defaultsMapKeys(workspace: Workspace): Set<string> {
  return new Set(listDefaultsMapEntries(workspace).map((entry) => entry.key));
}

export function listDefaultsMapEntries(workspace: Workspace): DefaultsMapEntryInfo[] {
  const map = findDefaultsMapBlock(workspace);
  if (!map) return [];
  const count = Number(
    (map as Blockly.Block & { itemCount_?: number }).itemCount_ ??
      mapCountFromInputs(map),
  );
  const entries: DefaultsMapEntryInfo[] = [];
  for (let i = 0; i < count; i++) {
    const key = String(map.getFieldValue(`KEY${i}`) ?? "").trim();
    if (!key) continue;
    const value = map.getInputTargetBlock(`VAL${i}`);
    entries.push({
      key,
      index: i,
      summary: summarizeValueBlock(value),
    });
  }
  return entries;
}

/**
 * Replace every `maps_get("defaults", key)` on the canvas with a clone of the
 * Defaults Map value for that key. Returns how many lookups were inlined.
 *
 * When the stored value is a `term_pick` (or similar) that cannot plug into the
 * parent mouth (e.g. `code_string` expects a String), the selected code is
 * inlined as a `text` literal instead — matching convert-time map lookup.
 */
export function hardcodeDefaultsMapKey(workspace: Workspace, key: string): number {
  const wanted = key.trim();
  if (!wanted) return 0;
  const map = findDefaultsMapBlock(workspace);
  if (!map || typeof Blockly.serialization?.blocks?.save !== "function") return 0;
  const entry = listDefaultsMapEntries(workspace).find((item) => item.key === wanted);
  if (!entry) return 0;
  const valueBlock = map.getInputTargetBlock(`VAL${entry.index}`);
  if (!valueBlock) return 0;
  const valueState = Blockly.serialization.blocks.save(valueBlock, {
    addCoordinates: false,
  });
  if (!valueState) return 0;

  const lookups = workspace.getAllBlocks(false).filter((block) =>
    block.type === MAPS_GET &&
    String(block.getFieldValue("NAME") ?? "") === DEFAULTS_MAP_NAME &&
    mapsGetKey(block) === wanted
  );
  let replaced = 0;
  for (const lookup of lookups) {
    const parentConnection = lookup.outputConnection?.targetConnection;
    if (!parentConnection) continue;
    lookup.dispose(false);
    if (inlineValueAt(workspace, parentConnection, valueBlock, valueState)) {
      replaced++;
    }
  }
  return replaced;
}

function inlineValueAt(
  workspace: Workspace,
  parentConnection: Blockly.Connection,
  valueBlock: Blockly.Block,
  valueState: unknown,
): boolean {
  if (typeof Blockly.serialization?.blocks?.append === "function") {
    const clone = Blockly.serialization.blocks.append(
      structuredClone(valueState) as Record<string, unknown>,
      workspace,
    ) as Blockly.Block | undefined;
    if (clone?.outputConnection && tryConnect(parentConnection, clone.outputConnection)) {
      finalizeBlock(clone);
      return true;
    }
    clone?.dispose(false);
  }
  const literal = literalFallbackBlock(workspace, valueBlock);
  if (literal?.outputConnection && tryConnect(parentConnection, literal.outputConnection)) {
    finalizeBlock(literal);
    return true;
  }
  literal?.dispose(false);
  return false;
}

function tryConnect(parent: Blockly.Connection, child: Blockly.Connection): boolean {
  try {
    parent.connect(child);
  } catch {
    return false;
  }
  return parent.isConnected() && parent.targetConnection === child;
}

function literalFallbackBlock(
  workspace: Workspace,
  valueBlock: Blockly.Block,
): Blockly.Block | null {
  if (valueBlock.type === "term_pick") {
    const code = String(valueBlock.getFieldValue("CODE") ?? "");
    const text = workspace.newBlock("text");
    text.setFieldValue(code, "TEXT");
    return text;
  }
  if (valueBlock.type === "text" || valueBlock.type === "math_number" ||
    valueBlock.type === "logic_boolean" || valueBlock.type.startsWith("party_")) {
    if (typeof Blockly.serialization?.blocks?.save !== "function" ||
      typeof Blockly.serialization?.blocks?.append !== "function") {
      return null;
    }
    const state = Blockly.serialization.blocks.save(valueBlock, { addCoordinates: false });
    if (!state) return null;
    return Blockly.serialization.blocks.append(
      structuredClone(state) as Record<string, unknown>,
      workspace,
    ) as Blockly.Block;
  }
  return null;
}

function finalizeBlock(block: Blockly.Block): void {
  if (typeof document === "undefined") return;
  const svg = block as Blockly.Block & { initSvg?: () => void; render?: () => void };
  svg.initSvg?.();
  svg.render?.();
}

export function defaultsMapValueBlock(
  workspace: Workspace,
  key: string,
): Blockly.Block | null {
  const map = findDefaultsMapBlock(workspace);
  if (!map) return null;
  const wanted = key.trim();
  if (!wanted) return null;
  const count = Number(
    (map as Blockly.Block & { itemCount_?: number }).itemCount_ ??
      mapCountFromInputs(map),
  );
  for (let i = 0; i < count; i++) {
    if (String(map.getFieldValue(`KEY${i}`) ?? "").trim() !== wanted) continue;
    return map.getInputTargetBlock(`VAL${i}`);
  }
  return null;
}

function findDefaultsMapBlock(workspace: Workspace): Blockly.Block | null {
  for (const block of workspace.getTopBlocks(false)) {
    if (block.type === DEFAULTS_BLOCK_TYPE) {
      return block.getInputTargetBlock("MAP");
    }
  }
  return null;
}

function mapCountFromInputs(map: Blockly.Block): number {
  let n = 0;
  while (map.getInput(`VAL${n}`) || map.getField(`KEY${n}`)) n++;
  return n;
}

function mapsGetKey(block: Blockly.Block): string {
  const keyBlock = block.getInputTargetBlock("KEY");
  if (!keyBlock) return "";
  if (keyBlock.type === "text") return String(keyBlock.getFieldValue("TEXT") ?? "").trim();
  return String(keyBlock.getFieldValue("TEXT") ?? keyBlock.getFieldValue("NUM") ?? "").trim();
}

function summarizeValueBlock(block: Blockly.Block | null): string {
  if (!block) return "(empty)";
  if (block.type === "text") return JSON.stringify(String(block.getFieldValue("TEXT") ?? ""));
  if (block.type === "term_pick") {
    const set = String(block.getFieldValue("SET") ?? "");
    const code = String(block.getFieldValue("CODE") ?? "");
    return `${set || "term"} → ${code || "?"}`;
  }
  if (block.type === "party_self") return "PARTY_SELF";
  if (block.type === "party_identified") return "PARTY_IDENTIFIED";
  if (block.type === "party_related") return "PARTY_RELATED";
  if (block.type === "math_number") return String(block.getFieldValue("NUM") ?? "");
  return block.type;
}
