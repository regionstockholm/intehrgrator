import { Blockly } from "../blockly_core.ts";
import {
  DEFAULTS_BLOCK_TYPE,
  DEFAULTS_MAP_NAME,
  MAPS_CREATE_WITH,
  MAPS_GET,
} from "../../core/defaults/extract.ts";

const MAP_COLOUR = "#7E57C2";
const DEFAULTS_COLOUR = "#5C6BC0";
const DEFAULTS_TOOLTIP = [
  "Conversion-time openEHR context values for Better/EHRbase simplified formats.",
  "Standard keys: language, territory, time, composer_name, and health_care_facility.",
  'Use manage to load or save a set; maps_get("defaults", key) retrieves a value.',
].join(" ");

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
      let i = 0;
      while (this.getInput(`KEY${i}`) || this.getInput(`VAL${i}`)) {
        if (i >= this.itemCount_) {
          this.removeInput(`KEY${i}`, true);
          this.removeInput(`VAL${i}`, true);
        }
        i++;
      }
      for (let n = 0; n < this.itemCount_; n++) {
        if (!this.getInput(`KEY${n}`)) {
          this.appendValueInput(`KEY${n}`)
            .setCheck("String")
            .appendField("key");
        }
        if (!this.getInput(`VAL${n}`)) {
          this.appendValueInput(`VAL${n}`).appendField("value");
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
        .appendField("openEHR CTX defaults", "TITLE")
        .appendField(
          new Blockly.FieldImage(
            FOLDER_SVG,
            18,
            18,
            "Load or save CTX defaults",
            () => {
              defaultsMapPickHandler?.();
            },
          ),
          "MANAGE_ICON",
        )
        .appendField("manage", "MANAGE_LABEL");
      this.appendDummyInput("CONTEXT")
        .appendField("Better / EHRbase conversion context");
      this.appendValueInput("MAP")
        .setCheck("Map")
        .appendField("values");
      this.setColour(DEFAULTS_COLOUR);
      this.setTooltip(DEFAULTS_TOOLTIP);
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
