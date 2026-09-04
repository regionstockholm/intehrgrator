/**
 * Classify Blockly workspace events for semantic history (not x/y layout drags).
 */

import { Blockly } from "../blockly/blockly_core.ts";
import { DOCUMENT_SWAP_EVENT_TYPE } from "./document_undo.ts";
import { SHEET_CHANGE_EVENT_TYPE } from "./sheet_undo.ts";

const SEMANTIC_MOVE = new Set([
  Blockly.Events.BLOCK_CREATE,
  Blockly.Events.BLOCK_DELETE,
  Blockly.Events.BLOCK_CHANGE,
]);

/** True when the event should append a joint history entry. */
export function isSemanticBlocklyEvent(event: Blockly.Events.Abstract): boolean {
  if (event.isUiEvent) return false;
  if (event.type === Blockly.Events.FINISHED_LOADING) return false;
  if (event.type === Blockly.Events.CLICK) return false;
  if (event.type === DOCUMENT_SWAP_EVENT_TYPE) return true;
  if (event.type === SHEET_CHANGE_EVENT_TYPE) return true;
  if (SEMANTIC_MOVE.has(event.type)) return true;
  if (event.type === Blockly.Events.BLOCK_MOVE) {
    const move = event as Blockly.Events.BlockMove;
    return move.oldParentId !== move.newParentId
      || move.oldInputName !== move.newInputName
      || Boolean(move.recordUndo);
  }
  return false;
}

export function summarizeBlocklyEvent(event: Blockly.Events.Abstract): string {
  switch (event.type) {
    case Blockly.Events.BLOCK_CREATE:
      return "Add block";
    case Blockly.Events.BLOCK_DELETE:
      return "Remove block";
    case Blockly.Events.BLOCK_CHANGE:
      return "Edit block field";
    case Blockly.Events.BLOCK_MOVE:
      return "Connect or move block";
    case DOCUMENT_SWAP_EVENT_TYPE:
      return "Load project or template";
    case SHEET_CHANGE_EVENT_TYPE:
      return "Edit sheet";
    default:
      return "Edit mapping canvas";
  }
}
