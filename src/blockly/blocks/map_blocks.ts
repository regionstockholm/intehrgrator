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

function pairInputNames(index: number): [string, string, string] {
  return [`KEY${index}`, `VAL${index}`, `ROW${index}`];
}

/** Keep HEADER, then each key:value pair, on their own rows (Blockly 11 EndRowInput). */
function updateMapCreateShape(block: MapCreateBlock): void {
  if (
    !block.getInput("HEADER_END") &&
    typeof block.appendEndRowInput === "function"
  ) {
    block.appendEndRowInput("HEADER_END");
  }

  if (block.itemCount_ === 0) {
    let i = 0;
    while (
      block.getInput(`KEY${i}`) || block.getInput(`VAL${i}`) ||
      block.getInput(`ROW${i}`)
    ) {
      block.removeInput(`KEY${i}`, true);
      block.removeInput(`VAL${i}`, true);
      block.removeInput(`ROW${i}`, true);
      i++;
    }
    if (!block.getInput("EMPTY")) {
      block.appendDummyInput("EMPTY").appendField("empty");
    }
  } else {
    if (block.getInput("EMPTY")) block.removeInput("EMPTY");
    let i = block.itemCount_;
    while (
      block.getInput(`KEY${i}`) || block.getInput(`VAL${i}`) ||
      block.getInput(`ROW${i}`)
    ) {
      block.removeInput(`KEY${i}`, true);
      block.removeInput(`VAL${i}`, true);
      block.removeInput(`ROW${i}`, true);
      i++;
    }
    for (let n = 0; n < block.itemCount_; n++) {
      const [keyName, valName, rowName] = pairInputNames(n);
      if (!block.getInput(keyName)) {
        block.appendValueInput(keyName)
          .setCheck("String")
          .setAlign(inputAlignRight())
          .appendField("key");
      }
      if (!block.getInput(valName)) {
        block.appendValueInput(valName).appendField(":");
      }
      if (
        !block.getInput(rowName) &&
        typeof block.appendEndRowInput === "function"
      ) {
        block.appendEndRowInput(rowName);
      }
    }
  }

  const order = ["HEADER", "HEADER_END"];
  for (let n = 0; n < block.itemCount_; n++) {
    order.push(...pairInputNames(n));
  }
  if (block.getInput("EMPTY")) order.push("EMPTY");
  for (const name of order) {
    if (block.getInput(name)) block.moveInputBefore(name, null);
  }
}

export function registerMapBlocks(): void {
  if (Blockly.Blocks[MAPS_CREATE_WITH]) return;

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
      this.setInputsInline(true);
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
    const text = workspace.newBlock("text");
    text.setFieldValue(key, "TEXT");
    if (text.outputConnection) {
      keyInput.connection.connect(text.outputConnection);
    }
  }
  return block;
}
