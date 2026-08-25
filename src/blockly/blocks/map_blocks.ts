import { Blockly } from "../blockly_core.ts";
import {
  DEFAULTS_BLOCK_TYPE,
  DEFAULTS_MAP_NAME,
  MAPS_CREATE_WITH,
  MAPS_GET,
} from "../../core/defaults/extract.ts";
import { FieldSkeletonTitle } from "../field_skeleton_title.ts";

const MAP_COLOUR = "#7E57C2";
const DEFAULTS_COLOUR = "#5C6BC0";

const PLUS_SVG =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="8" fill="#fff" stroke="#5f6368"/><path d="M9 5v8M5 9h8" stroke="#5f6368" stroke-width="1.6" fill="none"/></svg>',
  );
const MINUS_SVG =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="8" fill="#fff" stroke="#5f6368"/><path d="M5 9h8" stroke="#5f6368" stroke-width="1.6" fill="none"/></svg>',
  );
const FOLDER_SVG =
  "data:image/svg+xml," +
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
      this.setInputsInline(false);
      this.updateShape_();
    },
    saveExtraState: function (this: MapCreateBlock) {
      const keys: string[] = [];
      for (let i = 0; i < this.itemCount_; i++) {
        keys.push(String(this.getFieldValue(`KEY${i}`) ?? ""));
      }
      return { itemCount: this.itemCount_, keys };
    },
    loadExtraState: function (
      this: MapCreateBlock,
      state: { itemCount?: number; keys?: string[] },
    ) {
      this.itemCount_ = Number(state?.itemCount ?? 0);
      this.updateShape_();
      if (Array.isArray(state?.keys)) {
        for (let i = 0; i < state.keys.length && i < this.itemCount_; i++) {
          this.setFieldValue(String(state.keys[i] ?? ""), `KEY${i}`);
        }
      }
    },
    updateShape_: function (this: MapCreateBlock) {
      let i = 0;
      while (this.getInput(`KEY${i}`) || this.getInput(`VAL${i}`)) {
        if (i >= this.itemCount_) {
          this.removeInput(`KEY${i}`, true);
          this.removeInput(`VAL${i}`, true);
        }
        i++;
      }
      for (let n = 0; n < this.itemCount_; n++) {
        if (this.getInput(`KEY${n}`)) this.removeInput(`KEY${n}`, true);
        if (!this.getInput(`VAL${n}`)) {
          this.appendValueInput(`VAL${n}`)
            .appendField(new Blockly.FieldTextInput(""), `KEY${n}`)
            .appendField("=");
        }
      }
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
        .appendField(new Blockly.FieldTextInput(DEFAULTS_MAP_NAME), "NAME")
        .appendField(".")
        .appendField(new Blockly.FieldTextInput("language"), "KEY");
      this.setOutput(true, "String");
      this.setColour(MAP_COLOUR);
      this.setTooltip("Look up a value in a named Map (defaults.language, …)");
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
        .appendField(new FieldSkeletonTitle("CTX", "Defaults", ""))
        .appendField(
          new Blockly.FieldImage(FOLDER_SVG, 18, 18, "Load/save", () => {
            defaultsMapPickHandler?.();
          }),
        );
      this.appendValueInput("MAP").setCheck("Map");
      this.setColour(DEFAULTS_COLOUR);
      this.setTooltip(
        "Conversion-time CTX defaults (language, territory, composer_name, …). Map lookups use the name defaults, not a wire.",
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
  block.setFieldValue(key, "KEY");
  return block;
}
