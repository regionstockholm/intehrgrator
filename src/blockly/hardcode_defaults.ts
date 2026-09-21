/**
 * Hardcode (inline) a default context map entry: replace canvas
 * `maps_get("defaults", runtimeKey)` lookups with a copy of that entry's value.
 */
import type { Workspace } from "blockly/core";
import { Blockly } from "./blockly_core.ts";
import {
  DEFAULT_CONTEXT_MAP_TYPE,
  DEFAULTS_MAP_NAME,
  MAPS_GET,
  parseTargetsField,
} from "../core/defaults/mod.ts";
import { FieldScaffoldTargets } from "./field_scaffold_targets.ts";
import { contextMapItemCount } from "./blocks/default_context_map.ts";

export interface DefaultsMapEntryInfo {
  runtimeKey: string;
  scaffoldTargets: string[];
  index: number;
  /** Alias of runtimeKey (hardcode picker / older tests). */
  key: string;
  summary: string;
}

/** Runtime keys currently present on the unique default context map. */
export function defaultsMapKeys(workspace: Workspace): Set<string> {
  return new Set(
    listDefaultContextMapEntries(workspace).map((entry) => entry.runtimeKey).filter(Boolean),
  );
}

export function listDefaultsMapEntries(workspace: Workspace): DefaultsMapEntryInfo[] {
  return listDefaultContextMapEntries(workspace);
}

export function listDefaultContextMapEntries(workspace: Workspace): DefaultsMapEntryInfo[] {
  const map = findDefaultsMapBlock(workspace);
  if (!map) return [];
  const count = contextMapItemCount(map);
  const extra = (map as Blockly.Block & {
    saveExtraState?: () => { targets?: string[][] };
  }).saveExtraState?.();
  const entries: DefaultsMapEntryInfo[] = [];
  for (let i = 0; i < count; i++) {
    const runtimeKey = String(map.getFieldValue(`KEY${i}`) ?? "").trim();
    const field = map.getField(`TARGETS${i}`) as FieldScaffoldTargets | null;
    const fromField = field?.getTargets() ?? parseTargetsField(map.getFieldValue(`TARGETS${i}`));
    const scaffoldTargets = fromField.length ? fromField : extra?.targets?.[i] ?? [];
    const value = map.getInputTargetBlock(`VAL${i}`);
    entries.push({
      runtimeKey,
      scaffoldTargets,
      index: i,
      key: runtimeKey,
      summary: summarizeValueBlock(value),
    });
  }
  return entries;
}

/**
 * Replace every `maps_get("defaults", key)` on the canvas with a clone of the
 * entry value for that **runtime key**. Returns how many lookups were inlined.
 */
export function hardcodeDefaultsMapKey(workspace: Workspace, key: string): number {
  const wanted = key.trim();
  if (!wanted) return 0;
  const map = findDefaultsMapBlock(workspace);
  if (!map || typeof Blockly.serialization?.blocks?.save !== "function") return 0;
  const entry = listDefaultContextMapEntries(workspace).find((item) => item.runtimeKey === wanted);
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
    if (clone?.isShadow?.()) clone.setShadow(false);
    if (clone?.outputConnection && tryConnect(parentConnection, clone.outputConnection)) {
      if (clone.isShadow?.()) clone.setShadow(false);
      finalizeBlock(clone);
      return true;
    }
    clone?.dispose(false);
  }
  const literal = literalFallbackBlock(workspace, valueBlock);
  if (literal?.isShadow?.()) literal.setShadow(false);
  if (literal?.outputConnection && tryConnect(parentConnection, literal.outputConnection)) {
    if (literal.isShadow?.()) literal.setShadow(false);
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
  if (
    valueBlock.type === "text" || valueBlock.type === "math_number" ||
    valueBlock.type === "logic_boolean" || valueBlock.type.startsWith("party_")
  ) {
    if (
      typeof Blockly.serialization?.blocks?.save !== "function" ||
      typeof Blockly.serialization?.blocks?.append !== "function"
    ) {
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
  const count = contextMapItemCount(map);
  for (let i = 0; i < count; i++) {
    if (String(map.getFieldValue(`KEY${i}`) ?? "").trim() !== wanted) continue;
    return map.getInputTargetBlock(`VAL${i}`);
  }
  return null;
}

function findDefaultsMapBlock(workspace: Workspace): Blockly.Block | null {
  for (const block of workspace.getTopBlocks(false)) {
    if (block.type === DEFAULT_CONTEXT_MAP_TYPE) return block;
  }
  return null;
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
