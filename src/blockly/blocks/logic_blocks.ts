import { Blockly } from "../blockly_core.ts";
import { FieldDropdownHug } from "../field_dropdown_hug.ts";
import { detectLocale, msg } from "../i18n/locale.ts";
import {
  appendBlockOutputGlyph,
  appendInputTypeGlyph,
  inputAlignLeft,
  inputAlignRight,
  registerStockBlocklyGlyphs,
} from "../block_type_glyph.ts";

const LOGIC_COLOUR = "#D1C4E9";
const LIST_COLOUR = "#4DB6AC";

export const LOGIC_LIST_RESTRICTION_BLOCK = "logic_list_restriction";
export const LOGIC_CURRENT_ITEM_BLOCK = "logic_current_item";
export const LISTS_SET_OPERATION_BLOCK = "lists_set_operation";

export const LIST_LOGIC_BLOCK_TYPES = [
  LOGIC_LIST_RESTRICTION_BLOCK,
  LOGIC_CURRENT_ITEM_BLOCK,
  LISTS_SET_OPERATION_BLOCK,
] as const;

const LIST_CHECK = ["Array", "Source"];

/** Name bound to each list item while the condition is evaluated. */
export const DEFAULT_ITEM_NAME = "item";

/** Sentinel `VAR` value on `logic_current_item`: resolve the nearest enclosing binder. */
export const NEAREST_ITEM = "";

const RESTRICTION_CALLS = {
  ALL: "all_of",
  ANY: "any_of",
  NONE: "none_of",
  AT_LEAST: "at_least",
  AT_MOST: "at_most",
  EXACTLY: "exactly",
} as const;

export type RestrictionOp = keyof typeof RESTRICTION_CALLS;
export type RestrictionCall = typeof RESTRICTION_CALLS[RestrictionOp];

const SET_CALLS = {
  BOTH: "intersection",
  EITHER: "union",
  NOT_IN: "difference",
} as const;

export type SetOp = keyof typeof SET_CALLS;
export type SetCall = typeof SET_CALLS[SetOp];

/** `at least` / `at most` / `exactly` carry a threshold; the quantifiers do not. */
export function restrictionOpNeedsCount(op: string): boolean {
  return op === "AT_LEAST" || op === "AT_MOST" || op === "EXACTLY";
}

/**
 * Operators that hold on an empty list whatever their threshold is.
 *
 * These are the ones where vacuous truth surprises people (“all specimens are
 * labelled” is true when there are no specimens), so they offer the
 * **require at least one item** guard. `any` and `at least n` are already false
 * on an empty list, and `exactly 0` is true there on purpose.
 */
export function restrictionOpHoldsOnEmptyList(op: string): boolean {
  return op === "ALL" || op === "NONE" || op === "AT_MOST";
}

export function restrictionOpToCall(op: string): RestrictionCall {
  return RESTRICTION_CALLS[op as RestrictionOp] ?? "all_of";
}

export function callToRestrictionOp(name: string): RestrictionOp {
  for (const op of Object.keys(RESTRICTION_CALLS) as RestrictionOp[]) {
    if (RESTRICTION_CALLS[op] === name) return op;
  }
  return "ALL";
}

export function isRestrictionCall(name: string): name is RestrictionCall {
  return (Object.values(RESTRICTION_CALLS) as string[]).includes(name);
}

export function setOpToCall(op: string): SetCall {
  return SET_CALLS[op as SetOp] ?? "intersection";
}

export function callToSetOp(name: string): SetOp {
  for (const op of Object.keys(SET_CALLS) as SetOp[]) {
    if (SET_CALLS[op] === name) return op;
  }
  return "BOTH";
}

export function isSetCall(name: string): name is SetCall {
  return (Object.values(SET_CALLS) as string[]).includes(name);
}

// deno-lint-ignore no-explicit-any
const FieldDropdownHugBase = FieldDropdownHug as any;

/**
 * Dropdown whose legal options depend on the surrounding blocks.
 *
 * Stock `FieldDropdown` validates against its cached option list, so a value that
 * only became legal once the block was connected — including one restored from a
 * saved workspace — is rejected. Regenerate the options before validating.
 */
class FieldItemDropdown extends FieldDropdownHugBase {
  doClassValidation_(newValue?: string): string | null {
    this.getOptions(false);
    return super.doClassValidation_(newValue);
  }
}

interface RestrictionExtraState {
  count?: boolean;
  guard?: boolean;
  itemNamed?: boolean;
  itemName?: string;
}

type RestrictionBlock = Blockly.Block & {
  itemName_: string;
  countValue_: number;
  guardValue_: boolean;
  updateOpShape_: (op: string) => void;
  setCountField_: (show: boolean) => void;
  setGuardRow_: (show: boolean) => void;
  updateItemRow_: (show: boolean) => void;
};

/**
 * Logic blocks that restrict a list.
 *
 * `logic_list_restriction` covers the OWL Manchester quantifiers (`only`/`some`/
 * `none`) and cardinalities (`min`/`max`/`exactly` n) behind one dropdown, worded
 * as "all of ⟨list⟩ match ⟨condition⟩". `logic_current_item` references the item
 * being tested. `lists_set_operation` combines two lists as classes
 * (intersection / union / difference) and lives in the Lists & maps drawer,
 * because it returns a list rather than a Boolean.
 */
export function registerLogicBlocks(): void {
  const m = msg(detectLocale());

  Blockly.Blocks[LOGIC_LIST_RESTRICTION_BLOCK] = {
    init: function (this: RestrictionBlock) {
      this.itemName_ = DEFAULT_ITEM_NAME;
      this.countValue_ = 1;
      this.guardValue_ = false;
      const header = this.appendDummyInput("HEADER").setAlign(inputAlignLeft());
      appendBlockOutputGlyph(header, "Boolean");
      const listInput = this.appendValueInput("LIST")
        .setAlign(inputAlignRight())
        .setCheck(LIST_CHECK)
        .appendField(
          new FieldDropdownHug(
            [
              [m.LOGIC_ALL, "ALL"],
              [m.LOGIC_ANY, "ANY"],
              [m.LOGIC_NONE, "NONE"],
              [m.LOGIC_AT_LEAST, "AT_LEAST"],
              [m.LOGIC_AT_MOST, "AT_MOST"],
              [m.LOGIC_EXACTLY, "EXACTLY"],
            ],
            // deno-lint-ignore no-explicit-any
            function (this: any, value: string) {
              const owner = this.getSourceBlock?.() as RestrictionBlock | null;
              owner?.updateOpShape_?.(String(value));
              return undefined;
            },
          ),
          "OP",
        )
        .appendField(m.LOGIC_OF, "OF_LABEL");
      appendInputTypeGlyph(listInput, LIST_CHECK);
      const predInput = this.appendValueInput("PRED")
        .setAlign(inputAlignRight())
        .setCheck("Boolean")
        .appendField(m.LOGIC_MATCH, "MATCH_LABEL");
      appendInputTypeGlyph(predInput, "Boolean");
      this.setInputsInline(false);
      this.setOutput(true, "Boolean");
      this.setColour(LOGIC_COLOUR);
      this.setTooltip(m.LOGIC_RESTRICTION_TOOLTIP);
      this.setStyle?.("logic_blocks");
    },

    /** Threshold field and empty-list guard both follow the chosen operator. */
    updateOpShape_: function (this: RestrictionBlock, op: string) {
      this.setCountField_(restrictionOpNeedsCount(op));
      this.setGuardRow_(restrictionOpHoldsOnEmptyList(op));
    },

    setCountField_: function (this: RestrictionBlock, show: boolean) {
      const listInput = this.getInput("LIST");
      const field = this.getField("N");
      if (!listInput || show === Boolean(field)) return;
      if (show) {
        listInput.insertFieldAt(1, new Blockly.FieldNumber(this.countValue_, 0, undefined, 1), "N");
        return;
      }
      // Remember the threshold so switching back to a counting operator restores it.
      const stored = Number(field!.getValue());
      this.countValue_ = Number.isFinite(stored) ? stored : 1;
      listInput.removeField("N", true);
    },

    setGuardRow_: function (this: RestrictionBlock, show: boolean) {
      const predInput = this.getInput("PRED");
      const field = this.getField("NONEMPTY");
      if (show === Boolean(field)) return;
      if (show) {
        predInput
          ?.appendField(new Blockly.FieldCheckbox(this.guardValue_), "NONEMPTY")
          .appendField(m.LOGIC_REQUIRE_ITEMS, "NONEMPTY_LABEL");
        return;
      }
      this.guardValue_ = isFieldChecked(this, "NONEMPTY");
      predInput?.removeField("NONEMPTY", true);
      predInput?.removeField("NONEMPTY_LABEL", true);
    },

    /** The item name is only needed for nesting, so it stays hidden by default. */
    updateItemRow_: function (this: RestrictionBlock, show: boolean) {
      const existing = this.getInput("ITEM");
      if (show === Boolean(existing)) return;
      if (show) {
        this.appendDummyInput("ITEM")
          .appendField(m.LOGIC_ITEM_NAME, "ITEM_LABEL")
          .appendField(new Blockly.FieldTextInput(this.itemName_, sanitizeItemName), "VAR");
        return;
      }
      this.itemName_ = restrictionItemName(this);
      this.removeInput("ITEM", true);
    },

    saveExtraState: function (this: RestrictionBlock): RestrictionExtraState | null {
      const state: RestrictionExtraState = {};
      if (this.getField("N")) state.count = true;
      if (this.getField("NONEMPTY")) state.guard = true;
      if (this.getInput("ITEM")) state.itemNamed = true;
      const name = restrictionItemName(this);
      if (name !== DEFAULT_ITEM_NAME) state.itemName = name;
      return Object.keys(state).length > 0 ? state : null;
    },

    /**
     * Inputs load after extra state, so the threshold field and the guard row
     * have to exist before their values arrive.
     */
    loadExtraState: function (this: RestrictionBlock, state: RestrictionExtraState | null) {
      this.itemName_ = typeof state?.itemName === "string" && state.itemName
        ? state.itemName
        : DEFAULT_ITEM_NAME;
      this.setCountField_(Boolean(state?.count));
      this.setGuardRow_(Boolean(state?.guard));
      this.updateItemRow_(Boolean(state?.itemNamed));
    },

    /** Nested restrictions need names to tell the two items apart. */
    onchange: function (this: RestrictionBlock, event: { type?: string } | null) {
      if (this.isInFlyout || !this.workspace) return;
      if (event?.type !== "move" && event?.type !== "create") return;
      if (this.getInput("ITEM")) return;
      const ancestors = restrictionAncestors(this);
      if (ancestors.length === 0) return;
      for (const ancestor of ancestors) ancestor.updateItemRow_(true);
      this.itemName_ = freshItemName(
        this.itemName_,
        ancestors.map((ancestor) => restrictionItemName(ancestor)),
      );
      this.updateItemRow_(true);
    },

    // deno-lint-ignore no-explicit-any
    customContextMenu: function (this: RestrictionBlock, options: any[]) {
      const shown = Boolean(this.getInput("ITEM"));
      options.push({
        text: shown ? m.LOGIC_HIDE_ITEM_NAME : m.LOGIC_NAME_ITEM,
        enabled: true,
        callback: () => this.updateItemRow_(!shown),
      });
    },
  };

  Blockly.Blocks[LOGIC_CURRENT_ITEM_BLOCK] = {
    init: function (this: Blockly.Block) {
      const header = this.appendDummyInput("HEADER").setAlign(inputAlignLeft());
      appendBlockOutputGlyph(header, "Boolean");
      header.appendField(new FieldItemDropdown(currentItemOptions), "VAR");
      this.setOutput(true, "Boolean");
      this.setColour(LOGIC_COLOUR);
      this.setTooltip(m.LOGIC_CURRENT_ITEM_TOOLTIP);
      this.setStyle?.("logic_blocks");
    },
  };

  Blockly.Blocks[LISTS_SET_OPERATION_BLOCK] = {
    init: function (this: Blockly.Block) {
      const header = this.appendDummyInput("HEADER").setAlign(inputAlignLeft());
      appendBlockOutputGlyph(header, "Array");
      const inputA = this.appendValueInput("A")
        .setAlign(inputAlignRight())
        .setCheck(LIST_CHECK)
        .appendField(
          new FieldDropdownHug(
            [
              [m.LOGIC_SET_BOTH, "BOTH"],
              [m.LOGIC_SET_EITHER, "EITHER"],
              [m.LOGIC_SET_NOT_IN, "NOT_IN"],
            ],
            // deno-lint-ignore no-explicit-any
            function (this: any, value: string) {
              const owner = this.getSourceBlock?.() as Blockly.Block | null;
              if (owner) updateSetConnector(owner, String(value));
              return undefined;
            },
          ),
          "OP",
        );
      appendInputTypeGlyph(inputA, LIST_CHECK);
      const inputB = this.appendValueInput("B")
        .setAlign(inputAlignRight())
        .setCheck(LIST_CHECK)
        .appendField(new Blockly.FieldLabel(m.LOGIC_SET_CONN_AND), "CONN");
      appendInputTypeGlyph(inputB, LIST_CHECK);
      this.setInputsInline(true);
      this.setOutput(true, "Array");
      this.setColour(LIST_COLOUR);
      this.setTooltip(m.LOGIC_SET_TOOLTIP);
      this.setStyle?.("list_blocks");
    },
  };

  registerStockBlocklyGlyphs();
}

/** "and" / "or" / "but not in" — the connector follows the chosen set operator. */
function updateSetConnector(block: Blockly.Block, op: string): void {
  const m = msg(detectLocale());
  const text = op === "EITHER"
    ? m.LOGIC_SET_CONN_OR
    : op === "NOT_IN"
    ? m.LOGIC_SET_CONN_NOT_IN
    : m.LOGIC_SET_CONN_AND;
  block.getField("CONN")?.setValue(text);
}

/** `FieldCheckbox` reads back as `"TRUE"`, but deserializes from a boolean. */
function isFieldChecked(block: Blockly.Block, name: string): boolean {
  const value = block.getFieldValue(name);
  return value === true || value === "TRUE";
}

/** An inner item must not shadow an outer one, or `var(name)` picks the wrong item. */
function freshItemName(name: string, taken: string[]): string {
  if (!taken.includes(name)) return name;
  for (let suffix = 2;; suffix++) {
    const candidate = `${name}${suffix}`;
    if (!taken.includes(candidate)) return candidate;
  }
}

function sanitizeItemName(value: string): string {
  const cleaned = String(value ?? "").trim().replace(/[^A-Za-z0-9_]/g, "_");
  return cleaned || DEFAULT_ITEM_NAME;
}

/** The item name, whether or not the block is showing the name row. */
export function restrictionItemName(block: Blockly.Block): string {
  const field = block.getField("VAR");
  if (field) return sanitizeItemName(field.getText());
  const stored = (block as Partial<RestrictionBlock>).itemName_;
  return stored ? sanitizeItemName(stored) : DEFAULT_ITEM_NAME;
}

/** Reveal the name row when the name differs from the default. */
export function setRestrictionItemName(block: Blockly.Block, name: string): void {
  const clean = sanitizeItemName(name);
  const restriction = block as RestrictionBlock;
  restriction.itemName_ = clean;
  if (clean === DEFAULT_ITEM_NAME) return;
  restriction.updateItemRow_?.(true);
  block.getField("VAR")?.setValue(clean);
}

export function restrictionCount(block: Blockly.Block): number {
  const raw = block.getField("N")?.getValue();
  const n = Number(raw ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Whether this restriction excludes the empty list on top of its operator. */
export function restrictionRequiresItems(block: Blockly.Block): boolean {
  if (!restrictionOpHoldsOnEmptyList(String(block.getFieldValue("OP") ?? "ALL"))) return false;
  return isFieldChecked(block, "NONEMPTY");
}

export function setRestrictionRequiresItems(block: Blockly.Block, required: boolean): void {
  const restriction = block as RestrictionBlock;
  restriction.guardValue_ = required;
  restriction.updateOpShape_?.(String(block.getFieldValue("OP") ?? "ALL"));
  block.getField("NONEMPTY")?.setValue(required);
}

/**
 * Blocks that bind an item name around `block`, innermost first.
 *
 * A restriction only binds inside its condition — an item reference sitting in the
 * list socket is out of scope. `for_each_source` / `for_each_list` bind their whole body.
 */
function enclosingBinders(block: Blockly.Block | null): Blockly.Block[] {
  const found: Blockly.Block[] = [];
  let child = block;
  let parent = block?.getParent() ?? null;
  while (parent && child) {
    const bindsChild = parent.type === LOGIC_LIST_RESTRICTION_BLOCK
      ? parent.getInputWithBlock?.(child)?.name === "PRED"
      : parent.type === "for_each_source" || parent.type === "for_each_list";
    if (bindsChild) found.push(parent);
    child = parent;
    parent = parent.getParent();
  }
  return found;
}

function binderItemName(block: Blockly.Block): string {
  if (block.type === LOGIC_LIST_RESTRICTION_BLOCK) return restrictionItemName(block);
  return sanitizeItemName(String(block.getFieldValue("VAR") ?? DEFAULT_ITEM_NAME));
}

function restrictionAncestors(block: Blockly.Block): RestrictionBlock[] {
  return enclosingBinders(block)
    .filter((binder) => binder.type === LOGIC_LIST_RESTRICTION_BLOCK) as RestrictionBlock[];
}

/** Item names in scope, innermost first. */
export function enclosingItemNames(block: Blockly.Block | null): string[] {
  const names = enclosingBinders(block).map(binderItemName);
  return names.filter((name, index) => names.indexOf(name) === index);
}

/** The item a `logic_current_item` block refers to. */
export function currentItemName(block: Blockly.Block): string {
  const chosen = String(block.getFieldValue("VAR") ?? NEAREST_ITEM);
  if (chosen !== NEAREST_ITEM) return chosen;
  return enclosingItemNames(block)[0] ?? DEFAULT_ITEM_NAME;
}

/** "this item" plus any outer item names, so nested restrictions stay reachable. */
// deno-lint-ignore no-explicit-any
function currentItemOptions(this: any): Array<[string, string]> {
  const m = msg(detectLocale());
  const options: Array<[string, string]> = [[m.LOGIC_THIS_ITEM, NEAREST_ITEM]];
  const block = this?.getSourceBlock?.() as Blockly.Block | null;
  for (const name of enclosingItemNames(block).slice(1)) {
    options.push([name, name]);
  }
  const current = String(this?.getValue?.() ?? NEAREST_ITEM);
  if (current !== NEAREST_ITEM && !options.some(([, value]) => value === current)) {
    options.push([current, current]);
  }
  return options;
}
