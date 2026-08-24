/**
 * Live constraint decorations on RM Blockly blocks.
 *
 * Warning triangles fire when a contained constraint is unmet (unmapped
 * mandatory value, abstract EVENT, empty required slot). They do **not**
 * light up merely because a node is template/RM-mandatory.
 */
import type { Block, Workspace } from "blockly/core";
import { Blockly } from "./blockly_core.ts";
import { TERM_PICK_NONE } from "../core/openehr_term_catalog.ts";
import { isAbstractType } from "../core/rm_meta.ts";
import { isGenericValueBlockType } from "./blocks/target_blocks.ts";
import {
  expressionBlockFromDataValueShell,
  isDataValueBlock,
  isEventFamilyType,
  presentAttributeNames,
  RM_ATTR_INPUT_PREFIX,
  OPTIONAL_INPUT_PREFIX,
} from "./blocks/rm_blocks.ts";
import { isTermPickBlock } from "./blocks/term_pick.ts";
import {
  cardinalityFieldOnInput,
  formatSlotCardinality,
  isCardinalityMet,
  type SlotCardinality,
} from "./slot_cardinality.ts";

export const ABSTRACT_EVENT_WARNING =
  "EVENT is abstract. Choose POINT_EVENT or INTERVAL_EVENT — runtime instances cannot be the abstract EVENT class.";

const STATEMENT_INPUT_TYPE = 3;

export function refreshWorkspaceConstraints(workspace: Workspace): void {
  for (const block of workspace.getAllBlocks(false)) {
    if (typeof block.isShadow === "function" && block.isShadow()) continue;
    refreshSlotCardinalityState(block);
    const messages = blockConstraintMessages(block);
    block.setWarningText(messages.length ? messages.join("\n") : null);
  }
}

export function blockConstraintMessages(block: Block): string[] {
  const messages: string[] = [];
  const rmType = (block.getFieldValue("RM_TYPE") || "").toUpperCase();
  if (rmType === "EVENT") {
    messages.push(ABSTRACT_EVENT_WARNING);
  }

  if (isMandatoryFlag(block) && isUnmappedValueBlock(block)) {
    messages.push("Unmapped mandatory value");
  }

  for (const unmet of unmetSlotCards(block)) {
    messages.push(
      `${unmet.attr} needs ${formatSlotCardinality(unmet.card)} (has ${unmet.count})`,
    );
  }
  return messages;
}

export function warningTextOf(block: Block): string | null {
  const iconsApi = Blockly.icons as
    | { WarningIcon?: { TYPE?: unknown } }
    | undefined;
  const type = iconsApi?.WarningIcon?.TYPE;
  const getIcon = (block as unknown as {
    getIcon?: (iconType: unknown) => { getText?: () => string } | null;
  }).getIcon;
  if (type && typeof getIcon === "function") {
    const text = getIcon.call(block, type)?.getText?.() ?? "";
    if (text) return text;
  }
  const legacy = block as unknown as { getWarningText?: () => string | null };
  if (typeof legacy.getWarningText === "function") {
    return legacy.getWarningText() || null;
  }
  return null;
}

export function isAbstractEventBlock(block: Block): boolean {
  const rmType = (block.getFieldValue("RM_TYPE") || "").toUpperCase();
  return rmType === "EVENT" && (isEventFamilyType(rmType) || isAbstractType("EVENT"));
}

function refreshSlotCardinalityState(block: Block): void {
  for (const input of block.inputList) {
    const field = cardinalityFieldOnInput(input);
    if (!field) continue;
    const count = countInputChildren(block, input.name);
    field.setUnmet(!isCardinalityMet(count, { min: field.min, max: field.max }));
  }
}

function unmetSlotCards(
  block: Block,
): Array<{ attr: string; card: SlotCardinality; count: number }> {
  const out: Array<{ attr: string; card: SlotCardinality; count: number }> = [];
  for (const input of block.inputList) {
    const field = cardinalityFieldOnInput(input);
    if (!field) continue;
    const card = { min: field.min, max: field.max };
    const count = countInputChildren(block, input.name);
    if (isCardinalityMet(count, card)) continue;
    const attr = input.name.startsWith(RM_ATTR_INPUT_PREFIX)
      ? input.name.slice(RM_ATTR_INPUT_PREFIX.length)
      : input.name.startsWith(OPTIONAL_INPUT_PREFIX)
      ? input.name.slice(OPTIONAL_INPUT_PREFIX.length)
      : input.name.toLowerCase();
    out.push({ attr, card, count });
  }
  return out;
}

export function countInputChildren(block: Block, inputName: string): number {
  const input = block.getInput(inputName);
  if (!input?.connection) return 0;
  const first = input.connection.targetBlock();
  if (!first) return 0;
  if (input.type !== STATEMENT_INPUT_TYPE) return 1;
  let n = 0;
  let current: Block | null = first;
  while (current) {
    n++;
    current = current.getNextBlock();
  }
  return n;
}

function isMandatoryFlag(block: Block): boolean {
  const raw = block.getFieldValue("MANDATORY");
  return raw === "1" || raw === "true";
}

function isUnmappedValueBlock(block: Block): boolean {
  if (isTermPickBlock(block)) {
    const code = block.getFieldValue("CODE");
    return !code || code === TERM_PICK_NONE;
  }
  if (block.type === "element" || isGenericValueBlockType(block.type)) {
    const value = block.getInput("VALUE")?.connection?.targetBlock();
    if (!value) return true;
    if (isDataValueBlock(value)) {
      return !expressionBlockFromDataValueShell(value);
    }
    return false;
  }
  if (isDataValueBlock(block)) {
    return !expressionBlockFromDataValueShell(block);
  }
  return false;
}

/** Used by tests and optional RM to know which ATTR_/OPT_ mouths exist. */
export function connectedAttributeNames(block: Block): string[] {
  return presentAttributeNames(block).filter((name) => {
    const input = block.getInput(`${RM_ATTR_INPUT_PREFIX}${name}`) ??
      block.getInput(`${OPTIONAL_INPUT_PREFIX}${name}`);
    return Boolean(input?.connection?.targetBlock());
  });
}
