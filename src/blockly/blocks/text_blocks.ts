import { Blockly } from "../blockly_core.ts";
import { FieldDropdownHug } from "../field_dropdown_hug.ts";
import {
  FieldCodeMirror,
  registerFieldCodeMirror,
} from "../field_codemirror.ts";
import { EDITOR_LANGUAGE_OPTIONS } from "../../workbench/codemirror_setup.ts";
import { msg, detectLocale } from "../i18n/locale.ts";

import {
  applyInstanceRootCap,
  TEXT_DOCUMENT_BLOCK_TYPE,
} from "../instance_root.ts";
import { appendBlockOutputGlyph, appendInputTypeGlyph } from "../block_type_glyph.ts";

export const TEXT_CODE_BLOCK_TYPE = "text_code";
export const TEXT_HANDLEBARS_BLOCK_TYPE = "text_handlebars";
export { TEXT_DOCUMENT_BLOCK_TYPE };

const TEXT_COLOUR = "#FFCA28";

export function registerTextBlocks(): void {
  registerFieldCodeMirror();
  const m = msg(detectLocale());

  Blockly.Blocks[TEXT_CODE_BLOCK_TYPE] = {
    init: function (this: Blockly.Block) {
      const editor = new FieldCodeMirror("");
      this.appendDummyInput("HEADER")
        .appendField(m.TEXT_CODE)
        .appendField(
          new FieldDropdownHug(
            EDITOR_LANGUAGE_OPTIONS,
            (value: string) => {
              editor.setLanguage(value);
              return value;
            },
          ),
          "LANG",
        );
      this.appendDummyInput("EDITOR").appendField(editor, "TEXT");
      this.setFieldValue("handlebars", "LANG");
      editor.setLanguage("handlebars");
      this.setOutput(true, "String");
      this.setColour(TEXT_COLOUR);
      this.setTooltip(m.TEXT_CODE_TOOLTIP);
      this.setStyle?.("text_blocks");
      this.setInputsInline(false);
    },
  };

  Blockly.Blocks[TEXT_HANDLEBARS_BLOCK_TYPE] = {
    init: function (this: Blockly.Block) {
      this.appendValueInput("SCRIPT")
        .setCheck("String")
        .appendField(m.TEXT_HANDLEBARS);
      this.appendValueInput("CONTEXT")
        .setCheck(["Map", "Source"])
        .appendField(m.TEXT_HANDLEBARS_WITH);
      this.setOutput(true, "String");
      this.setColour(TEXT_COLOUR);
      this.setTooltip(m.TEXT_HANDLEBARS_TOOLTIP);
      this.setStyle?.("text_blocks");
      this.setInputsInline(false);
    },
  };

  Blockly.Blocks[TEXT_DOCUMENT_BLOCK_TYPE] = {
    init: function (this: Blockly.Block) {
      const header = this.appendDummyInput("HEADER");
      appendBlockOutputGlyph(header, "String");
      header.appendField("Text document");
      const value = this.appendValueInput("VALUE").setCheck("String");
      appendInputTypeGlyph(value, "String");
      value.appendField("content");
      applyInstanceRootCap(this);
      this.setColour(TEXT_COLOUR);
      this.setTooltip(
        "Free-form text instance root. Plug in Code text, Handlebars text, or a string Source query.",
      );
      this.setStyle?.("text_blocks");
    },
  };
}
