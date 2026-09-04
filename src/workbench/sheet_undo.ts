/**
 * One undo step for Sheet JSON edits so Mapping Editors Undo/Redo
 * (Blockly's stack) owns the grid — jspreadsheet history stays off.
 */
import type { Workspace } from "blockly/core";
import { Blockly } from "../blockly/blockly_core.ts";
import type { SheetDocument } from "../core/sheets/mod.ts";

export const SHEET_CHANGE_EVENT_TYPE = "intehr_sheet_change";

type AbstractEvent = InstanceType<typeof Blockly.Events.Abstract>;

export class SheetChangeEvent extends Blockly.Events.Abstract {
  override isBlank = false;
  override type = SHEET_CHANGE_EVENT_TYPE;
  override recordUndo = true;
  override isUiEvent = false;
  before: SheetDocument[];
  after: SheetDocument[];
  private readonly restore: (sheets: SheetDocument[]) => void;

  constructor(
    workspace: Workspace,
    before: SheetDocument[],
    after: SheetDocument[],
    restore: (sheets: SheetDocument[]) => void,
  ) {
    super();
    this.workspaceId = workspace.id;
    this.before = before;
    this.after = after;
    this.restore = restore;
  }

  override isNull(): boolean {
    return JSON.stringify(this.before) === JSON.stringify(this.after);
  }

  override run(forward: boolean): void {
    this.restore(forward ? this.after : this.before);
  }
}

export function fireSheetChange(
  workspace: Workspace,
  before: SheetDocument[],
  after: SheetDocument[],
  restore: (sheets: SheetDocument[]) => void,
): void {
  const event = new SheetChangeEvent(workspace, before, after, restore);
  if (event.isNull()) return;
  Blockly.Events.fire(event as AbstractEvent);
}
