import { Blockly } from "./blockly_core.ts";

export const COMPACT_RENDERER_NAME = "thrasos-compact";

/**
 * Thrasos with tighter padding so mapping blocks spend less vertical space.
 * Puzzle-tab geometry is left at Thrasos defaults so connections still mate.
 */
export function registerCompactThrasosRenderer(): string {
  // deno-lint-ignore no-explicit-any
  const Base = Blockly.thrasos.Renderer as any;
  class CompactThrasosRenderer extends Base {
    makeConstants_() {
      const constants = super.makeConstants_();
      constants.SMALL_PADDING = 2;
      constants.MEDIUM_PADDING = 4;
      constants.LARGE_PADDING = 6;
      constants.MIN_BLOCK_HEIGHT = 18;
      constants.FIELD_BORDER_RECT_X_PADDING = 3;
      constants.FIELD_BORDER_RECT_Y_PADDING = 1;
      constants.FIELD_TEXT_HEIGHT = 14;
      constants.FIELD_TEXT_BASELINE = 11;
      constants.EMPTY_INLINE_INPUT_PADDING = 6;
      constants.EMPTY_INLINE_INPUT_HEIGHT = 18;
      constants.DUMMY_INPUT_MIN_HEIGHT = 16;
      constants.BETWEEN_STATEMENT_PADDING_Y = 2;
      constants.STATEMENT_BOTTOM_SPACER = 4;
      constants.STATEMENT_INPUT_PADDING_LEFT = 8;
      return constants;
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
