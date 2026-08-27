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

/**
 * Treat `fn` as one undo step. Joins an existing Blockly event group
 * (mutator compose, drop) instead of nesting a second group id.
 */
export function withBlocklyUndoGroup(fn: () => void): void {
  const existing = typeof Blockly.Events.getGroup === "function"
    ? Blockly.Events.getGroup()
    : "";
  const started = !existing;
  if (started && typeof Blockly.Events.setGroup === "function") {
    Blockly.Events.setGroup(true);
  }
  try {
    fn();
  } finally {
    if (started && typeof Blockly.Events.setGroup === "function") {
      Blockly.Events.setGroup(false);
    }
  }
}
