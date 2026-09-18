/**
 * Richer collapsed-block summaries (issue #150).
 */
import type { Block } from "blockly/core";
import { Blockly } from "./blockly_core.ts";
import { isRmContainerBlockType, OPTIONAL_INPUT_PREFIX, RM_ATTR_INPUT_PREFIX } from "./blocks/rm_blocks.ts";
const MAPS_CREATE_WITH = "maps_create_with";
import { TERM_PICK_BLOCK_TYPE } from "./blocks/term_pick.ts";
import { TERM_PICK_NONE, termSetById } from "../core/openehr_term_catalog.ts";
import { summarizeValueBlock } from "./hardcode_defaults.ts";

/** Enough room for several child labels on one or two lines. */
export const COLLAPSED_TEXT_LIMIT = 240;

let installed = false;

export function registerCollapsedSummaries(): void {
  if (installed) return;
  installed = true;

  if (typeof Blockly.COLLAPSE_CHARS === "number") {
    Blockly.COLLAPSE_CHARS = COLLAPSED_TEXT_LIMIT;
  }

  const original = Blockly.Block.prototype.toString as (
    this: Block,
    maxLength?: number,
    emptyToken?: string,
  ) => string;

  Blockly.Block.prototype.toString = function (
    maxLength?: number,
    emptyToken?: string,
  ): string {
    const custom = customCollapsedSummary(this, emptyToken);
    const text = custom ?? original.call(this, maxLength, emptyToken);
    const limit = maxLength ?? COLLAPSED_TEXT_LIMIT;
    if (text.length <= limit) return text;
    return text.substring(0, Math.max(0, limit - 3)) + "...";
  };
}

function customCollapsedSummary(block: Block, emptyToken = "?"): string | null {
  if (isRmContainerBlockType(block.type)) return summarizeRmContainer(block, emptyToken);
  if (block.type === MAPS_CREATE_WITH) return summarizeMapCreate(block);
  if (block.type === TERM_PICK_BLOCK_TYPE) return summarizeTermPick(block);
  if (block.type === "lists_create_with") return summarizeListCreate(block, emptyToken);
  return null;
}

function blockTitle(block: Block): string {
  const name = String(block.getFieldValue("NAME") ?? "").trim();
  if (name) return name;
  const rm = String(block.getFieldValue("RM_TYPE") ?? block.type).trim();
  return rm || block.type;
}

function summarizeStatementStack(block: Block | null, emptyToken: string): string[] {
  const labels: string[] = [];
  let current: Block | null = block;
  while (current) {
    const label = summarizeChild(current, emptyToken);
    if (label) labels.push(label);
    current = current.getNextBlock();
  }
  return labels;
}

function summarizeChild(block: Block | null, emptyToken: string): string {
  if (!block || block.isShadow()) return "";
  if (block.type === TERM_PICK_BLOCK_TYPE) return summarizeTermPick(block);
  const title = blockTitle(block);
  return title || block.type || emptyToken;
}

function summarizeRmContainer(block: Block, emptyToken: string): string {
  const parts: string[] = [blockTitle(block)];
  for (const input of block.inputList) {
    if (input.name === "HEADER" || input.name.startsWith("PROHIBITED_")) continue;
    const isMouth = input.name.startsWith(RM_ATTR_INPUT_PREFIX) ||
      input.name.startsWith(OPTIONAL_INPUT_PREFIX);
    if (!isMouth) continue;
    const labels = summarizeStatementStack(input.connection?.targetBlock() ?? null, emptyToken);
    parts.push(...labels);
  }
  return parts.filter(Boolean).join(" · ");
}

function summarizeMapCreate(block: Block): string {
  const count = Number((block as Block & { itemCount_?: number }).itemCount_ ?? 0);
  const parts: string[] = ["map"];
  for (let i = 0; i < count; i++) {
    const key = String(block.getFieldValue(`KEY${i}`) ?? "").trim();
    if (!key) continue;
    const val = block.getInputTargetBlock(`VAL${i}`);
    parts.push(`${key}: ${summarizeValueBlock(val)}`);
  }
  return parts.join(" · ");
}

function summarizeListCreate(block: Block, emptyToken: string): string {
  const count = Number((block as Block & { itemCount_?: number }).itemCount_ ?? 0);
  const parts: string[] = ["list"];
  for (let i = 0; i < count; i++) {
    const child = block.getInputTargetBlock(`ADD${i}`);
    const label = summarizeChild(child, emptyToken);
    if (label) parts.push(label);
  }
  return parts.join(" · ");
}

function summarizeTermPick(block: Block): string {
  const setId = String(block.getFieldValue("SET") ?? "");
  const code = String(block.getFieldValue("CODE") ?? "");
  const set = termSetById(setId);
  const rubric = set?.codes.find((item) => item.code === code)?.rubric ?? code;
  const glyph = "◇";
  if (!code || code === TERM_PICK_NONE) return `${glyph} built-in`;
  const label = rubric && rubric !== code ? `${rubric} (${code})` : code;
  return `${glyph} ${label}`;
}
