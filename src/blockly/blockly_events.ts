import type { Workspace } from "blockly/core";
import { Blockly } from "./blockly_core.ts";

let afterEventsEnabled: (() => void) | null = null;

/** Register a hook (the minimap) to run when bulk event-suppressed edits finish. */
export function setAfterBlocklyEventsEnabled(handler: (() => void) | null): void {
  afterEventsEnabled = handler;
}

/** Copy block state from one workspace onto another (replaces destination). */
export function copyWorkspaceState(from: Workspace, to: Workspace): void {
  const state = Blockly.serialization.workspaces.save(from);
  Blockly.Events.disable();
  try {
    Blockly.serialization.workspaces.load(state, to);
  } finally {
    Blockly.Events.enable();
  }
}

/**
 * Run a bulk canvas mutation without firing Blockly events, then notify
 * listeners (minimap) once events are fully re-enabled.
 */
export function runWithoutBlocklyEvents(fn: () => void): void {
  Blockly.Events.disable();
  try {
    fn();
  } finally {
    Blockly.Events.enable();
    if (Blockly.Events.isEnabled()) {
      afterEventsEnabled?.();
    }
  }
}
