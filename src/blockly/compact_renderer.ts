import { Blockly } from "./blockly_core.ts";
import { isRmTypeEmojiField } from "./rm_type_emoji.ts";
import { isSlotCardinalityField } from "./slot_cardinality.ts";

export const COMPACT_RENDERER_NAME = "thrasos-compact";

/**
 * Thrasos with tighter padding so mapping blocks spend less vertical space.
 * Puzzle-tab geometry is left at Thrasos defaults so connections still mate.
 * In-row gaps next to ZipEHR type glyphs are reduced so they sit against
 * the class name and the connection notch.
 *
 * When a value input already has a child, Thrasos still appends the empty
 * socket subpath onto the parent `blocklyPath`. Modest-theme CSS strokes
 * every `.blocklyPath` white, so that extra bezier is drawn as a hook on
 * top of the nested child — especially inside a larger inline row. Skip
 * the hole and only position the connection.
 */
export function registerCompactThrasosRenderer(): string {
  // deno-lint-ignore no-explicit-any
  const Base = Blockly.thrasos.Renderer as any;
  // deno-lint-ignore no-explicit-any
  const BaseInfo = Blockly.thrasos.RenderInfo as any;
  // deno-lint-ignore no-explicit-any
  const BaseDrawer = Blockly.blockRendering.Drawer as any;

  class CompactRenderInfo extends (BaseInfo ?? Object) {
    // deno-lint-ignore no-explicit-any
    getInRowSpacing_(prev: any, next: any) {
      const spacing = super.getInRowSpacing_(prev, next);
      if (isRmEmojiMeasurable(prev) || isRmEmojiMeasurable(next) || isSlotCardMeasurable(prev) || isSlotCardMeasurable(next)) {
        return Math.min(spacing, 1);
      }
      // Tighten gaps between consecutive in-row fields (title, labels, +).
      if (prev?.field && next?.field) {
        return Math.min(spacing, 2);
      }
      return spacing;
    }
  }

  class CompactDrawer extends (BaseDrawer ?? Object) {
    // deno-lint-ignore no-explicit-any
    drawInlineInput_(input: any) {
      if (input?.connectedBlock) {
        this.positionInlineInputConnection_(input);
        return;
      }
      super.drawInlineInput_(input);
    }
  }

  class CompactThrasosRenderer extends Base {
    makeConstants_() {
      const constants = super.makeConstants_();
      applyCompactConstants(constants);
      return constants;
    }

    // deno-lint-ignore no-explicit-any
    init(theme: any, overrides?: any) {
      super.init(theme, overrides);
      applyCompactConstants(this.getConstants?.() ?? this.constants_);
    }

    // deno-lint-ignore no-explicit-any
    makeRenderInfo_(block: any) {
      if (BaseInfo) return new (CompactRenderInfo as any)(this, block);
      return super.makeRenderInfo_(block);
    }

    // deno-lint-ignore no-explicit-any
    makeDrawer_(block: any, info: any) {
      if (BaseDrawer) return new (CompactDrawer as any)(block, info);
      return super.makeDrawer_(block, info);
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

/** Theme `init()` rewrites dummy/inline heights from TAB_HEIGHT; re-apply after. */
// deno-lint-ignore no-explicit-any
function applyCompactConstants(constants: any): void {
  if (!constants) return;
  constants.SMALL_PADDING = 1;
  constants.MEDIUM_PADDING = 3;
  constants.LARGE_PADDING = 5;
  constants.FIELD_BORDER_RECT_X_PADDING = 2;
  constants.FIELD_BORDER_RECT_Y_PADDING = 1;
  constants.FIELD_TEXT_HEIGHT = 14;
  constants.FIELD_TEXT_BASELINE = 11;
  constants.BETWEEN_STATEMENT_PADDING_Y = 2;
  constants.STATEMENT_BOTTOM_SPACER = 4;
  constants.STATEMENT_INPUT_PADDING_LEFT = 1;
  const tabHeight = Number(constants.TAB_HEIGHT ?? 15);
  const tabRoom = tabHeight + 11;
  constants.MIN_BLOCK_HEIGHT = Math.max(24, tabRoom);
  constants.DUMMY_INPUT_MIN_HEIGHT = Math.max(tabRoom, Number(constants.DUMMY_INPUT_MIN_HEIGHT ?? 0));
  constants.EMPTY_INLINE_INPUT_HEIGHT = Math.max(tabRoom, Number(constants.EMPTY_INLINE_INPUT_HEIGHT ?? 0));
}

// deno-lint-ignore no-explicit-any
function isRmEmojiMeasurable(elem: any): boolean {
  return isRmTypeEmojiField(elem?.field ?? null);
}

function isSlotCardMeasurable(elem: any): boolean {
  return isSlotCardinalityField(elem?.field ?? null);
}
