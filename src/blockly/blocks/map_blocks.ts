import { Blockly } from "../blockly_core.ts";
import {
  DEFAULTS_BLOCK_TYPE,
  DEFAULTS_MAP_NAME,
  MAPS_CREATE_WITH,
  MAPS_GET,
} from "../../core/defaults/extract.ts";

const MAP_COLOUR = "#7E57C2";
const DEFAULTS_COLOUR = "#5C6BC0";

const PLUS_SVG = "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="8" fill="#fff" stroke="#5f6368"/><path d="M9 5v8M5 9h8" stroke="#5f6368" stroke-width="1.6" fill="none"/></svg>',
  );
const MINUS_SVG = "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="8" fill="#fff" stroke="#5f6368"/><path d="M5 9h8" stroke="#5f6368" stroke-width="1.6" fill="none"/></svg>',
  );
const FOLDER_SVG = "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><path d="M2 5h5l1 1.5H16v8.5H2z" fill="#fff" stroke="#5f6368"/><path d="M2 6.5h14" stroke="#5f6368"/></svg>',
  );

let defaultsMapPickHandler: (() => void) | null = null;

/** Workbench registers the Defaults Map catalog / file picker. */
export function setDefaultsMapPickHandler(handler: (() => void) | null): void {
  defaultsMapPickHandler = handler;
}

type MapCreateBlock = Blockly.Block & {
  itemCount_: number;
  updateShape_: () => void;
};

function inputAlignRight(): number {
  return (Blockly.inputs?.Align?.RIGHT ?? Blockly.ALIGN_RIGHT ?? 1) as number;
}

function keyField(defaultText = ""): Blockly.FieldTextInput {
  return new Blockly.FieldTextInput(defaultText, undefined, { spellcheck: false });
}

function removePairInputs(block: MapCreateBlock, index: number): void {
  block.removeInput(`VAL${index}`, true);
  block.removeInput(`KEY${index}`, true);
  block.removeInput(`ROW${index}`, true);
}

function hasPairInput(block: MapCreateBlock, index: number): boolean {
  return !!(
    block.getInput(`VAL${index}`) ||
    block.getInput(`KEY${index}`) ||
    block.getInput(`ROW${index}`)
  );
}

/**
 * App Inventor `dictionaries_create_with` stacks value sockets on the right
 * (`setInputsInline` left false, `Align.RIGHT`). Blockly JSON-object members
 * put the key in a `FieldTextInput` on that same row, with `:` before the
 * value connector. Keys stay editable fields in a column; values are ordinary
 * blocks (`text`, `math_number`, source queries, nested maps, …).
 */
function updateMapCreateShape(block: MapCreateBlock): void {
  if (block.getInput("HEADER_END")) block.removeInput("HEADER_END", true);

  if (block.itemCount_ === 0) {
    let i = 0;
    while (hasPairInput(block, i)) {
      removePairInputs(block, i);
      i++;
    }
    if (!block.getInput("EMPTY")) {
      block.appendDummyInput("EMPTY").appendField("empty");
    }
  } else {
    if (block.getInput("EMPTY")) block.removeInput("EMPTY");
    let i = block.itemCount_;
    while (hasPairInput(block, i)) {
      removePairInputs(block, i);
      i++;
    }
    for (let n = 0; n < block.itemCount_; n++) {
      if (block.getInput(`KEY${n}`)) block.removeInput(`KEY${n}`, true);
      if (block.getInput(`ROW${n}`)) block.removeInput(`ROW${n}`, true);
      if (block.getInput(`VAL${n}`)) continue;
      const input = block.appendValueInput(`VAL${n}`)
        .setAlign(inputAlignRight())
        .appendField(keyField(""), `KEY${n}`)
        .appendField(":");
      if (
        input.connection &&
        typeof input.connection.setShadowState === "function" &&
        Blockly.Blocks["text"]
      ) {
        input.connection.setShadowState({
          type: "text",
          fields: { TEXT: "" },
        });
      }
    }
  }

  const order = ["HEADER"];
  for (let n = 0; n < block.itemCount_; n++) order.push(`VAL${n}`);
  if (block.getInput("EMPTY")) order.push("EMPTY");
  for (const name of order) {
    if (block.getInput(name)) block.moveInputBefore(name, null);
  }
}

export function registerMapBlocks(): void {
  Blockly.Blocks[MAPS_CREATE_WITH] = {
    init: function (this: MapCreateBlock) {
      this.itemCount_ = 2;
      this.appendDummyInput("HEADER")
        .appendField("map")
        .appendField(
          new Blockly.FieldImage(PLUS_SVG, 18, 18, "+", () => {
            this.itemCount_ += 1;
            this.updateShape_();
          }),
        )
        .appendField(
          new Blockly.FieldImage(MINUS_SVG, 18, 18, "−", () => {
            if (this.itemCount_ <= 0) return;
            this.itemCount_ -= 1;
            this.updateShape_();
          }),
        );
      this.setOutput(true, "Map");
      this.setColour(MAP_COLOUR);
      this.setTooltip("Create a Map of key/value pairs");
      this.setInputsInline(false);
      this.updateShape_();
    },
    saveExtraState: function (this: MapCreateBlock) {
      return { itemCount: this.itemCount_ };
    },
    loadExtraState: function (
      this: MapCreateBlock,
      state: { itemCount?: number },
    ) {
      this.itemCount_ = Number(state?.itemCount ?? 0);
      this.updateShape_();
    },
    updateShape_: function (this: MapCreateBlock) {
      updateMapCreateShape(this);
    },
  };

  if (Blockly.Blocks[MAPS_GET]) return;

  Blockly.Blocks["maps_create_empty"] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput().appendField("empty map");
      this.setOutput(true, "Map");
      this.setColour(MAP_COLOUR);
      this.setTooltip("An empty Map");
    },
  };

  Blockly.Blocks[MAPS_GET] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField("get")
        .appendField(new Blockly.FieldTextInput(DEFAULTS_MAP_NAME), "NAME");
      this.appendValueInput("KEY")
        .setCheck("String")
        .appendField("key");
      this.setOutput(true, "String");
      this.setColour(MAP_COLOUR);
      this.setTooltip("Look up a value in a named Map");
      this.setInputsInline(true);
    },
  };

  Blockly.Blocks["maps_keys"] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField("keys of")
        .appendField(new Blockly.FieldTextInput(DEFAULTS_MAP_NAME), "NAME");
      this.setOutput(true, "Array");
      this.setColour(MAP_COLOUR);
      this.setInputsInline(true);
    },
  };

  Blockly.Blocks["maps_length"] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField("size of")
        .appendField(new Blockly.FieldTextInput(DEFAULTS_MAP_NAME), "NAME");
      this.setOutput(true, "Number");
      this.setColour(MAP_COLOUR);
      this.setInputsInline(true);
    },
  };

  Blockly.Blocks["maps_isEmpty"] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField("is empty")
        .appendField(new Blockly.FieldTextInput(DEFAULTS_MAP_NAME), "NAME");
      this.setOutput(true, "Boolean");
      this.setColour(MAP_COLOUR);
      this.setInputsInline(true);
    },
  };

  Blockly.Blocks[DEFAULTS_BLOCK_TYPE] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput("HEADER")
        .appendField("Defaults Map")
        .appendField(
          new Blockly.FieldImage(FOLDER_SVG, 18, 18, "Load/save", () => {
            defaultsMapPickHandler?.();
          }),
        );
      this.appendValueInput("MAP")
        .setCheck("Map")
        .appendField("map");
      this.setColour(DEFAULTS_COLOUR);
      this.setTooltip(
        "Binds a Map as the named defaults table. Lookups use maps_get by name, not a wire.",
      );
      this.setDeletable(false);
      this.setMovable(true);
    },
  };
}

export function createMapsGetBlock(
  workspace: Blockly.Workspace,
  mapName: string,
  key: string,
): Blockly.Block {
  const block = workspace.newBlock(MAPS_GET);
  block.setFieldValue(mapName, "NAME");
  const keyInput = block.getInput("KEY");
  if (keyInput?.connection) {
    const existing = keyInput.connection.targetBlock();
    if (existing) existing.dispose(false);
    if (typeof keyInput.connection.setShadowState === "function" && Blockly.Blocks["text"]) {
      keyInput.connection.setShadowState({
        type: "text",
        fields: { TEXT: key },
      });
    } else {
      const text = workspace.newBlock("text");
      text.setFieldValue(key, "TEXT");
      if (text.outputConnection) {
        keyInput.connection.connect(text.outputConnection);
      }
      initAndRender(text);
    }
  }
  initAndRender(block);
  return block;
}

function initAndRender(block: Blockly.Block): void {
  if (typeof document === "undefined") return;
  const svg = block as Blockly.Block & { initSvg?: () => void; render?: () => void };
  svg.initSvg?.();
  svg.render?.();
}
