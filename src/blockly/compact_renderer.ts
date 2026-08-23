import { Blockly } from "./blockly_core.ts";
import { isRmTypeEmojiField } from "./rm_type_emoji.ts";
import { isSlotCardinalityField } from "./slot_cardinality.ts";

export const COMPACT_RENDERER_NAME = "thrasos-compact";

/**
 * Thrasos with tighter padding so mapping blocks spend less vertical space.
 * Puzzle-tab geometry is left at Thrasos defaults so connections still mate.
 * In-row gaps next to ZipEHR type glyphs are reduced so they sit against
 * the class name and the connection notch.
 */
export function registerCompactThrasosRenderer(): string {
  // deno-lint-ignore no-explicit-any
  const Base = Blockly.thrasos.Renderer as any;
  // deno-lint-ignore no-explicit-any
  const BaseInfo = Blockly.thrasos.RenderInfo as any;

  class CompactRenderInfo extends (BaseInfo ?? Object) {
    // deno-lint-ignore no-explicit-any
    getInRowSpacing_(prev: any, next: any) {
      const spacing = super.getInRowSpacing_(prev, next);
      if (isRmEmojiMeasurable(prev) || isRmEmojiMeasurable(next) || isSlotCardMeasurable(prev) || isSlotCardMeasurable(next)) {
        return Math.min(spacing, 1);
      }
      return spacing;
    }
  }

  class CompactThrasosRenderer extends Base {
    makeConstants_() {
      const constants = super.makeConstants_();
      constants.SMALL_PADDING = 2;
      constants.MEDIUM_PADDING = 4;
      constants.LARGE_PADDING = 6;
      constants.MIN_BLOCK_HEIGHT = 24;
      constants.FIELD_BORDER_RECT_X_PADDING = 3;
      constants.FIELD_BORDER_RECT_Y_PADDING = 1;
      constants.FIELD_TEXT_HEIGHT = 14;
      constants.FIELD_TEXT_BASELINE = 11;
      constants.DUMMY_INPUT_MIN_HEIGHT = 24;
      constants.BETWEEN_STATEMENT_PADDING_Y = 2;
      constants.STATEMENT_BOTTOM_SPACER = 4;
      constants.STATEMENT_INPUT_PADDING_LEFT = 1;
      // Do not override EMPTY_INLINE_INPUT_* — puzzle-tab sockets need Thrasos defaults.
      return constants;
    }

    // deno-lint-ignore no-explicit-any
    makeRenderInfo_(block: any) {
      if (BaseInfo) return new CompactRenderInfo(this, block);
      return super.makeRenderInfo_(block);
    }
  }
  try {
    Blockly.blockRendering.unregister(COMPACT_RENDERER_NAME);
  } catch {
    // First registration in this page/runtime.
  }
  Blockly.blockRendering.register(
    COMPACT_RENDERER_NAME,
    // deno-lint-ignore no-explicit-any
    CompactThrasosRenderer as any,
  );
  return COMPACT_RENDERER_NAME;
}

// deno-lint-ignore no-explicit-any
function isRmEmojiMeasurable(elem: any): boolean {
  return isRmTypeEmojiField(elem?.field ?? null);
}

function isSlotCardMeasurable(elem: any): boolean {
  return isSlotCardinalityField(elem?.field ?? null);
}
