/**
 * Blockly dummy inputs always consume DUMMY_INPUT_MIN_HEIGHT, even when every
 * field is setVisible(false). Hidden SLOT_ID / RM_TYPE / … must live on an
 * existing visible row (HEADER) with a zero size so they serialize without
 * stretching the block.
 */
import { Blockly } from "./blockly_core.ts";

export function createHiddenSerializableField(value = "") {
  const field = new Blockly.FieldLabelSerializable(value);
  field.EDITABLE = false;
  field.SERIALIZABLE = true;
  const mutable = field as unknown as {
    initView?: () => void;
    render_?: () => void;
    updateSize_?: () => void;
    size_?: { width: number; height: number };
    getSize?: () => { width: number; height: number };
  };
  mutable.initView = () => {};
  mutable.render_ = () => {};
  mutable.updateSize_ = () => {
    if (mutable.size_) {
      mutable.size_.width = 0;
      mutable.size_.height = 0;
    }
  };
  if (mutable.size_) {
    mutable.size_.width = 0;
    mutable.size_.height = 0;
  }
  mutable.getSize = () => ({ width: 0, height: 0 });
  mutable.updateSize_?.();
  return field;
}

/** Append a serializable field that does not create a new dummy row. */
export function appendHiddenSerializable(
  block: Blockly.Block,
  name: string,
  value = "",
): void {
  if (block.getField(name)) return;
  const field = createHiddenSerializableField(value);
  const header = block.getInput("HEADER");
  if (header) {
    header.appendField(field, name);
    return;
  }
  const dummy = block.inputList.find((input) => !input.connection);
  if (dummy) {
    dummy.appendField(field, name);
    return;
  }
  block.appendDummyInput("HEADER").appendField(field, name);
}
