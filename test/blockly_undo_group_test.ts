import { assert, assertEquals } from "@std/assert";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import {
  replaceCanvasUndoable,
  withBlocklyUndoGroup,
} from "@intehrgrator/blockly/blockly_events.ts";

Deno.test("withBlocklyUndoGroup sets one group id for the duration of fn", () => {
  let seen = "";
  withBlocklyUndoGroup(() => {
    seen = Blockly.Events.getGroup();
    withBlocklyUndoGroup(() => {
      assertEquals(Blockly.Events.getGroup(), seen, "nested calls join the existing group");
    });
  });
  assert(seen.length > 0, "expected a group id while the action runs");
  assertEquals(Blockly.Events.getGroup(), "");
});

Deno.test("replaceCanvasUndoable is a no-op when apply does not change the canvas", () => {
  const workspace = new Blockly.Workspace();
  try {
    replaceCanvasUndoable(workspace, () => {});
    assertEquals(workspace.getUndoStack?.()?.length ?? 0, 0);
  } finally {
    workspace.dispose();
  }
});
