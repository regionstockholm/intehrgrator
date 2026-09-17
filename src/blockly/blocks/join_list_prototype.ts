/**
 * Throwaway prototype blocks for #85 join_list Blockly discussion.
 *
 * Not registered by `initBlocklyGenerators()`. The prototype page
 * (`web/prototype_join_list.ts`) is the only caller. Glyph helpers are
 * omitted so this file does not pull ehrtslib.
 */
import { Blockly } from "../blockly_core.ts";
import { FieldDropdownHug } from "../field_dropdown_hug.ts";
import {
  enforceMouthCaptionLayout,
  inputAlignLeft,
  inputAlignRight,
} from "../mouth_layout.ts";

const TEXT_COLOUR = "#FFCA28";
const LOGIC_COLOUR = "#D1C4E9";
const DT_COLOUR = "#00796B";
const LIST_COLOUR = "#4DB6AC";
const ELEMENT_COLOUR = "#3D7A6A";
const DV_COLOUR = "#4A6FA5";
const CLUSTER_COLOUR = "#005C53";
const SOURCE_COLOUR = "#E87722";

export const PROTOTYPE_JOIN_LIST = "prototype_join_list";
export const PROTOTYPE_JOIN_FOR_READING = "prototype_join_for_reading";
export const PROTOTYPE_JOIN_LOCALE = "prototype_join_locale";
export const PROTOTYPE_JOIN_VIA_TABLE = "prototype_join_via_table";
export const PROTOTYPE_DECISION_POSITION = "prototype_decision_position";
export const PROTOTYPE_DECISION_INDEX = "prototype_decision_index";
export const PROTOTYPE_LIST_IS_FIRST = "prototype_list_is_first";
export const PROTOTYPE_LIST_IS_LAST = "prototype_list_is_last";
export const PROTOTYPE_LIST_INDEX = "prototype_list_index";
export const PROTOTYPE_LIST_LENGTH = "prototype_list_length";
export const PROTOTYPE_THIS_ITEM = "prototype_this_item";
export const PROTOTYPE_JOIN_POSITION_RECIPE = "prototype_join_position_recipe";
export const PROTOTYPE_ELEMENT = "prototype_element";
export const PROTOTYPE_DV_TEXT = "prototype_dv_text";
export const PROTOTYPE_CLUSTER = "prototype_cluster";
export const PROTOTYPE_SOURCE_LIST = "prototype_source_list";

function quotedField(defaultText: string): Blockly.FieldTextInput {
  return new Blockly.FieldTextInput(defaultText, undefined, { spellcheck: false });
}

/**
 * Prototype-only blocks. Safe to call more than once (idempotent).
 */
export function registerJoinListPrototypeBlocks(): void {
  if (Blockly.Blocks[PROTOTYPE_JOIN_LIST]) return;

  /** Variant A — compact Text-category reporter (issue #85 proposed API). */
  Blockly.Blocks[PROTOTYPE_JOIN_LIST] = {
    init: function (this: Blockly.Block) {
      const header = this.appendDummyInput("HEADER").setAlign(inputAlignLeft());
      header.appendField("join list");
      const items = this.appendValueInput("ITEMS").setCheck("Array");
      items.appendField("items");
      const between = this.appendDummyInput("BETWEEN").setAlign(inputAlignRight());
      between
        .appendField("between")
        .appendField("“")
        .appendField(quotedField(", "), "SEP")
        .appendField("”");
      const last = this.appendDummyInput("LAST").setAlign(inputAlignRight());
      last
        .appendField("before last")
        .appendField("“")
        .appendField(quotedField(" och "), "FINAL")
        .appendField("”");
      this.setOutput(true, "String");
      this.setColour(TEXT_COLOUR);
      this.setStyle?.("text_blocks");
      this.setTooltip(
        "Turn a list of strings into readable enumeration. Two items use only the last separator.",
      );
      enforceMouthCaptionLayout(this);
    },
  };

  /**
   * Variant B — named mouths (Erik’s map scaffolding, first-class keys).
   * Prefix/postfix wrap the whole phrase; separators are not lambdas.
   */
  Blockly.Blocks[PROTOTYPE_JOIN_FOR_READING] = {
    init: function (this: Blockly.Block) {
      const header = this.appendDummyInput("HEADER").setAlign(inputAlignLeft());
      header.appendField("join for reading");
      const items = this.appendValueInput("ITEMS").setCheck("Array").setAlign(
        inputAlignRight(),
      );
      items.appendField("items");
      const prefix = this.appendValueInput("PREFIX").setCheck("String").setAlign(
        inputAlignRight(),
      );
      prefix.appendField("prefix");
      const between = this.appendDummyInput("BETWEEN").setAlign(inputAlignRight());
      between
        .appendField("between")
        .appendField("“")
        .appendField(quotedField(", "), "SEP")
        .appendField("”");
      const last = this.appendDummyInput("LAST").setAlign(inputAlignRight());
      last
        .appendField("before last")
        .appendField("“")
        .appendField(quotedField(" och "), "FINAL")
        .appendField("”");
      const postfix = this.appendValueInput("POSTFIX").setCheck("String").setAlign(
        inputAlignRight(),
      );
      postfix.appendField("postfix");
      const skip = this.appendDummyInput("SKIP").setAlign(inputAlignRight());
      skip.appendField("skip empty").appendField(
        new Blockly.FieldCheckbox("TRUE"),
        "SKIP_EMPTY",
      );
      this.setOutput(true, "String");
      this.setColour(TEXT_COLOUR);
      this.setStyle?.("text_blocks");
      this.setTooltip(
        "Same join_list algebra, with optional prefix/postfix and skip-empty. Keys are fixed — not a freeform Map.",
      );
      enforceMouthCaptionLayout(this);
    },
  };

  /**
   * Variant B-rich — per-position item templates (needs a bound `this item`).
   * Discuss-only: those sockets are lambdas, which Mapping Expression does not have.
   */
  Blockly.Blocks[PROTOTYPE_JOIN_POSITION_RECIPE] = {
    init: function (this: Blockly.Block) {
      const header = this.appendDummyInput("HEADER").setAlign(inputAlignLeft());
      header.appendField("join with item templates");
      const items = this.appendValueInput("ITEMS").setCheck("Array").setAlign(
        inputAlignRight(),
      );
      items.appendField("items");
      const prefix = this.appendValueInput("PREFIX").setCheck("String").setAlign(
        inputAlignRight(),
      );
      prefix.appendField("prefix");
      const first = this.appendValueInput("FIRST").setCheck("String").setAlign(
        inputAlignRight(),
      );
      first.appendField("first");
      const middle = this.appendValueInput("MIDDLE").setCheck("String").setAlign(
        inputAlignRight(),
      );
      middle.appendField("middle");
      const last = this.appendValueInput("LAST").setCheck("String").setAlign(
        inputAlignRight(),
      );
      last.appendField("last");
      const postfix = this.appendValueInput("POSTFIX").setCheck("String").setAlign(
        inputAlignRight(),
      );
      postfix.appendField("postfix");
      this.setOutput(true, "String");
      this.setColour(LIST_COLOUR);
      this.setStyle?.("list_blocks");
      this.setTooltip(
        "Prototype: first/middle/last sockets evaluate once per item (a lambda). Not in Mapping Expression today.",
      );
      enforceMouthCaptionLayout(this);
    },
  };

  /** Variant C — locale preset; separators are not authored. */
  Blockly.Blocks[PROTOTYPE_JOIN_LOCALE] = {
    init: function (this: Blockly.Block) {
      const header = this.appendDummyInput("HEADER").setAlign(inputAlignLeft());
      header.appendField("join list");
      const items = this.appendValueInput("ITEMS").setCheck("Array");
      items.appendField("items");
      const style = this.appendDummyInput("STYLE").setAlign(inputAlignRight());
      style
        .appendField("as")
        .appendField(
          new FieldDropdownHug([
            ["Svenska (och)", "sv"],
            ["English (and)", "en"],
            ["English (Oxford comma)", "en-oxford"],
          ]),
          "LOCALE",
        );
      const example = this.appendDummyInput("EXAMPLE").setAlign(inputAlignLeft());
      example.appendField("e.g. Anna, Bo och Carl");
      this.setOutput(true, "String");
      this.setColour(TEXT_COLOUR);
      this.setStyle?.("text_blocks");
      this.setTooltip(
        "Preset separators. v1 of #85 treats locale auto-detection as a non-goal; this is a convenience dropdown.",
      );
      enforceMouthCaptionLayout(this);
    },
  };

  /**
   * Variant D — join by evaluating a Decision table once per item.
   * Locals first/last/name are bound by the block, not Handlebars @first/@last.
   */
  Blockly.Blocks[PROTOTYPE_JOIN_VIA_TABLE] = {
    init: function (this: Blockly.Block) {
      const header = this.appendDummyInput("HEADER").setAlign(inputAlignLeft());
      header
        .appendField("join list using decision")
        .appendField(
          new Blockly.FieldTextInput("NärvarandeList", undefined, { spellcheck: false }),
          "TABLE",
        );
      const items = this.appendValueInput("ITEMS").setCheck("Array").setAlign(
        inputAlignRight(),
      );
      items.appendField("items");
      const hint = this.appendDummyInput("HINT").setAlign(inputAlignLeft());
      hint.appendField("binds first, last, name per item → concatenate snippets");
      this.setOutput(true, "String");
      this.setColour(DT_COLOUR);
      this.setTooltip(
        "Per-item FIRST match on is-first / is-last, then concatenate snippet cells. Not COLLECT of clinical rules.",
      );
      enforceMouthCaptionLayout(this);
    },
  };

  /** Lookalike of `decision_table` with named first/last/name mouths (no Map). */
  Blockly.Blocks[PROTOTYPE_DECISION_POSITION] = {
    init: function (this: Blockly.Block) {
      const header = this.appendDummyInput("HEADER").setAlign(inputAlignLeft());
      header
        .appendField("decision")
        .appendField(
          new Blockly.FieldTextInput("NärvarandeList", undefined, { spellcheck: false }),
          "NAME",
        )
        .appendField("→ snippet");
      const first = this.appendValueInput("FIRST").setCheck("Boolean").setAlign(
        inputAlignRight(),
      );
      first.appendField("first");
      const last = this.appendValueInput("LAST").setCheck("Boolean").setAlign(
        inputAlignRight(),
      );
      last.appendField("last");
      const name = this.appendValueInput("ITEM").setCheck("String").setAlign(
        inputAlignRight(),
      );
      name.appendField("name");
      this.setOutput(true, "String");
      this.setColour(DT_COLOUR);
      this.setTooltip(
        "One row of the position table. Locals are Blockly reporters, not Handlebars @first/@last.",
      );
      enforceMouthCaptionLayout(this);
    },
  };

  /** Variant E — same table, locals derived from loop index/length. */
  Blockly.Blocks[PROTOTYPE_DECISION_INDEX] = {
    init: function (this: Blockly.Block) {
      const header = this.appendDummyInput("HEADER").setAlign(inputAlignLeft());
      header
        .appendField("decision")
        .appendField(
          new Blockly.FieldTextInput("NärvarandeList", undefined, { spellcheck: false }),
          "NAME",
        )
        .appendField("→ snippet");
      const first = this.appendValueInput("FIRST").setCheck("Boolean").setAlign(
        inputAlignRight(),
      );
      first.appendField("first");
      const last = this.appendValueInput("LAST").setCheck("Boolean").setAlign(
        inputAlignRight(),
      );
      last.appendField("last");
      const odd = this.appendValueInput("ODD").setCheck("Boolean").setAlign(
        inputAlignRight(),
      );
      odd.appendField("odd");
      const name = this.appendValueInput("ITEM").setCheck("String").setAlign(
        inputAlignRight(),
      );
      name.appendField("name");
      this.setOutput(true, "String");
      this.setColour(DT_COLOUR);
      this.setTooltip(
        "Position locals built from index and length. odd/even is remainder of index ÷ 2.",
      );
      enforceMouthCaptionLayout(this);
    },
  };

  Blockly.Blocks[PROTOTYPE_LIST_IS_FIRST] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput().appendField("is first");
      this.setOutput(true, "Boolean");
      this.setColour(LOGIC_COLOUR);
      this.setStyle?.("logic_blocks");
      this.setTooltip("True for the first remaining item of the enclosing list join.");
      this.setInputsInline(true);
    },
  };

  Blockly.Blocks[PROTOTYPE_LIST_IS_LAST] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput().appendField("is last");
      this.setOutput(true, "Boolean");
      this.setColour(LOGIC_COLOUR);
      this.setStyle?.("logic_blocks");
      this.setTooltip("True for the last remaining item of the enclosing list join.");
      this.setInputsInline(true);
    },
  };

  Blockly.Blocks[PROTOTYPE_THIS_ITEM] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput().appendField("this item");
      this.setOutput(true, "String");
      this.setColour("#EF9A9A");
      this.setStyle?.("variable_blocks");
      this.setTooltip("The current list item while a join template or table row evaluates.");
      this.setInputsInline(true);
    },
  };

  Blockly.Blocks[PROTOTYPE_LIST_INDEX] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput().appendField("index");
      this.setOutput(true, "Number");
      this.setColour("#2196F3");
      this.setStyle?.("math_blocks");
      this.setTooltip("0-based index of the current item in the enclosing for_each_* / join.");
      this.setInputsInline(true);
    },
  };

  Blockly.Blocks[PROTOTYPE_LIST_LENGTH] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput().appendField("length");
      this.setOutput(true, "Number");
      this.setColour("#2196F3");
      this.setStyle?.("math_blocks");
      this.setTooltip("Length of the enclosing loop collection (stable for the duration of the loop).");
      this.setInputsInline(true);
    },
  };

  /**
   * Slim RM lookalikes for variant F. Real `element` / `dv_text` pull ehrtslib;
   * these are canvas-only so the playground stays Blockly-only.
   */
  Blockly.Blocks[PROTOTYPE_CLUSTER] = {
    init: function (this: Blockly.Block) {
      const header = this.appendDummyInput("HEADER").setAlign(inputAlignLeft());
      header
        .appendField("CLUSTER")
        .appendField(
          new Blockly.FieldTextInput("Lung-MDT", undefined, { spellcheck: false }),
          "NAME",
        );
      const items = this.appendStatementInput("ITEMS").setAlign(inputAlignRight());
      items.appendField("items").setCheck(["ITEM", "ELEMENT", "CLUSTER"]);
      this.setPreviousStatement(true, ["ITEM", "CLUSTER"]);
      this.setNextStatement(true, ["ITEM", "CLUSTER"]);
      this.setColour(CLUSTER_COLOUR);
      this.setTooltip("Prototype CLUSTER — statement stack of ELEMENTs (no ehrtslib).");
      enforceMouthCaptionLayout(this);
    },
  };

  Blockly.Blocks[PROTOTYPE_ELEMENT] = {
    init: function (this: Blockly.Block) {
      const header = this.appendDummyInput("HEADER").setAlign(inputAlignLeft());
      header
        .appendField("ELEMENT")
        .appendField(
          new Blockly.FieldTextInput("Närvarande", undefined, { spellcheck: false }),
          "NAME",
        );
      const value = this.appendValueInput("VALUE")
        .setAlign(inputAlignRight())
        .setCheck("DATA_VALUE");
      value.appendField("value");
      this.setPreviousStatement(true, ["ITEM", "ELEMENT", "CLUSTER"]);
      this.setNextStatement(true, ["ITEM", "ELEMENT", "CLUSTER"]);
      this.setColour(ELEMENT_COLOUR);
      this.setTooltip("Prototype ELEMENT — named data item with a DATA_VALUE.");
      enforceMouthCaptionLayout(this);
    },
  };

  Blockly.Blocks[PROTOTYPE_DV_TEXT] = {
    init: function (this: Blockly.Block) {
      const header = this.appendDummyInput("HEADER").setAlign(inputAlignLeft());
      header.appendField("DV_TEXT");
      const value = this.appendValueInput("VALUE")
        .setAlign(inputAlignRight())
        .setCheck("String");
      value.appendField("value");
      this.setOutput(true, "DATA_VALUE");
      this.setColour(DV_COLOUR);
      this.setTooltip("Prototype DV_TEXT — string value socket.");
      enforceMouthCaptionLayout(this);
    },
  };

  Blockly.Blocks[PROTOTYPE_SOURCE_LIST] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField("📋 source list")
        .appendField(
          new Blockly.FieldTextInput("deltagare/namn", undefined, { spellcheck: false }),
          "PATH",
        );
      this.setOutput(true, "Array");
      this.setColour(SOURCE_COLOUR);
      this.setStyle?.("colour_blocks");
      this.setTooltip(
        "Prototype source query that already returns string[] (names extracted earlier).",
      );
      this.setInputsInline(true);
    },
  };
}
