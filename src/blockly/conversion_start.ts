/**
 * Conversion start hat + helpers for Instance roots (ADR 0008 / #56).
 *
 * The hat designates the conversion product. It is not a Scratch event and
 * does not introduce statement order. At most one Start per workspace.
 */
import type { BlockSvg } from "blockly/core";
import type { TargetFormatId } from "../types/mod.ts";
import { Blockly } from "./blockly_core.ts";
import { msg, detectLocale } from "./i18n/locale.ts";

export const CONVERSION_START_TYPE = "conversion_start";
export const TEXT_DOCUMENT_TYPE = "text_document";

const START_COLOUR = "#43A047";

const guardedWorkspaces = new WeakSet<Blockly.Workspace>();

export function isInstanceRootBlockType(type: string): boolean {
  return type === "composition" ||
    type === "json_object" ||
    type === "xml_element" ||
    type === TEXT_DOCUMENT_TYPE ||
    type === "target_structure" ||
    type.startsWith("schema_");
}

export function conversionStartToolboxBlock(): Record<string, unknown> {
  return { kind: "block", type: CONVERSION_START_TYPE, gap: 8 };
}

export function registerConversionStartBlock(): void {
  const m = msg(detectLocale());
  if (!Blockly.Blocks[CONVERSION_START_TYPE]) {
    Blockly.Blocks[CONVERSION_START_TYPE] = {
      init: function (this: Blockly.Block) {
        this.appendDummyInput("HEADER").appendField(m.CONVERSION_START);
        this.setPreviousStatement(false);
        this.setNextStatement(true);
        this.setColour(START_COLOUR);
        this.setStyle?.("hat_blocks");
        this.setTooltip(m.CONVERSION_START_TOOLTIP);
        this.setInputsInline(true);
        this.onchange = function (this: Blockly.Block) {
          rejectNonInstanceRootNext(this);
        };
      },
    };
  }
}

function finalize(block: Blockly.Block): Blockly.Block {
  const svg = block as BlockSvg;
  if (typeof document !== "undefined") {
    svg.initSvg?.();
    svg.render?.();
  }
  return block;
}

export function findConversionStart(workspace: Blockly.Workspace): Blockly.Block | null {
  for (const block of workspace.getAllBlocks(false)) {
    if (block.type === CONVERSION_START_TYPE) return block;
  }
  return null;
}

/** Instance root under Start, or an uncapped top-level candidate. */
export function findInstanceRootBlock(workspace: Blockly.Workspace): Blockly.Block | null {
  const start = findConversionStart(workspace);
  const capped = start?.getNextBlock();
  if (capped && isInstanceRootBlockType(capped.type)) return capped;
  for (const block of workspace.getTopBlocks(false)) {
    if (isInstanceRootBlockType(block.type) && !block.getPreviousBlock()) return block;
  }
  return workspace.getAllBlocks(false).find((block) => isInstanceRootBlockType(block.type)) ??
    null;
}

export function instanceRootTypeOf(workspace: Blockly.Workspace): string | null {
  return findInstanceRootBlock(workspace)?.type ?? null;
}

export function inferTargetFormatFromRoot(type: string | null | undefined): TargetFormatId | undefined {
  if (!type) return undefined;
  if (type === "composition") return "openehr-template";
  if (type === "json_object" || type === "target_structure") return "json-schema";
  if (type === "xml_element") return "xml-schema";
  if (type === TEXT_DOCUMENT_TYPE) return "free-form";
  if (type.startsWith("schema_")) return undefined;
  return undefined;
}

export function inferTargetFormatFromBlocklyState(state: unknown): TargetFormatId | undefined {
  const type = instanceRootTypeFromBlocklyState(state);
  return inferTargetFormatFromRoot(type);
}

export function instanceRootTypeFromBlocklyState(state: unknown): string | null {
  if (!state || typeof state !== "object") return null;
  const tops = (state as { blocks?: { blocks?: Array<{ type?: string; next?: { block?: { type?: string } } }> } })
    .blocks?.blocks;
  if (!Array.isArray(tops)) return null;
  for (const root of tops) {
    if (root.type === CONVERSION_START_TYPE) {
      return root.next?.block?.type ?? null;
    }
  }
  for (const root of tops) {
    if (root.type && isInstanceRootBlockType(root.type)) return root.type;
  }
  return null;
}

export function canvasProductAllowsEmptyExample(state: unknown): boolean {
  const type = instanceRootTypeFromBlocklyState(state);
  return type === "json_object" || type === "xml_element" || type === TEXT_DOCUMENT_TYPE;
}

function rejectNonInstanceRootNext(start: Blockly.Block): void {
  const next = start.getNextBlock();
  if (!next) return;
  if (isInstanceRootBlockType(next.type)) {
    applyCappedRootNoNext(next);
    return;
  }
  next.previousConnection?.disconnect();
}

export function applyCappedRootNoNext(block: Blockly.Block): void {
  if (!isInstanceRootBlockType(block.type)) return;
  const prev = block.getPreviousBlock();
  const capped = prev?.type === CONVERSION_START_TYPE;
  const neverNext = block.type === "composition" || block.type === TEXT_DOCUMENT_TYPE;
  if (capped || neverNext) {
    if (block.nextConnection?.isConnected()) block.nextConnection.disconnect();
    block.setNextStatement(false);
    return;
  }
  if (!block.nextConnection && block.type !== "composition" && block.type !== TEXT_DOCUMENT_TYPE) {
    block.setPreviousStatement(true);
    block.setNextStatement(true);
  }
}

export function installInstanceRootNotches(): void {
  for (const type of ["json_object", "xml_element", "target_structure"]) {
    wrapInstanceRootOnchange(type);
  }
}

function wrapInstanceRootOnchange(type: string): void {
  const def = Blockly.Blocks[type] as { init?: (this: Blockly.Block) => void; onchange?: (this: Blockly.Block, e: unknown) => void } | undefined;
  if (!def?.init || (def as { _instanceRootWrapped?: boolean })._instanceRootWrapped) return;
  (def as { _instanceRootWrapped?: boolean })._instanceRootWrapped = true;
  const origInit = def.init;
  def.init = function (this: Blockly.Block) {
    origInit.apply(this);
    const prevOnchange = this.onchange;
    this.onchange = function (this: Blockly.Block, event: unknown) {
      prevOnchange?.call(this, event);
      applyCappedRootNoNext(this);
    };
  };
}

export function wrapSchemaInstanceRoot(type: string): void {
  wrapInstanceRootOnchange(type);
}

function dropDuplicateStarts(workspace: Blockly.Workspace, keep: Blockly.Block): void {
  for (const block of workspace.getAllBlocks(false)) {
    if (block.type === CONVERSION_START_TYPE && block.id !== keep.id) {
      block.dispose(false);
    }
  }
}

function findUncappedInstanceRoot(workspace: Blockly.Workspace): Blockly.Block | null {
  for (const block of workspace.getTopBlocks(false)) {
    if (!isInstanceRootBlockType(block.type)) continue;
    if (block.getPreviousBlock()) continue;
    return block;
  }
  return null;
}

/** Attach Start on an Instance root if missing. Join, do not replace Defaults. */
export function ensureConversionStart(workspace: Blockly.Workspace): Blockly.Block | null {
  registerConversionStartBlock();
  installConversionStartGuard(workspace);
  const existing = findConversionStart(workspace);
  if (existing) {
    dropDuplicateStarts(workspace, existing);
    if (!existing.getNextBlock()) {
      const root = findUncappedInstanceRoot(workspace);
      if (root?.previousConnection && existing.nextConnection) {
        existing.nextConnection.connect(root.previousConnection);
        applyCappedRootNoNext(root);
      }
    }
    return existing;
  }
  const root = findUncappedInstanceRoot(workspace);
  if (!root) return null;
  const start = workspace.newBlock(CONVERSION_START_TYPE);
  finalize(start);
  dropDuplicateStarts(workspace, start);
  if (root.previousConnection && start.nextConnection) {
    start.nextConnection.connect(root.previousConnection);
    applyCappedRootNoNext(root);
  } else {
    const xy = typeof root.getRelativeToSurfaceXY === "function"
      ? root.getRelativeToSurfaceXY()
      : { x: 20, y: 80 };
    if (typeof (start as BlockSvg).moveBy === "function") {
      (start as BlockSvg).moveBy(xy.x, Math.max(20, xy.y - 48));
    }
  }
  return start;
}

export function installConversionStartGuard(workspace: Blockly.Workspace): void {
  if (guardedWorkspaces.has(workspace)) return;
  guardedWorkspaces.add(workspace);
  workspace.addChangeListener((event: { type?: string; blockId?: string }) => {
    if (event.type !== Blockly.Events.BLOCK_CREATE && event.type !== Blockly.Events.BLOCK_MOVE) {
      return;
    }
    const starts = workspace.getAllBlocks(false).filter((block) => block.type === CONVERSION_START_TYPE);
    if (starts.length <= 1) {
      const only = starts[0];
      if (only) rejectNonInstanceRootNext(only);
      return;
    }
    const keep = starts.find((block) => block.getNextBlock()) ?? starts[0]!;
    dropDuplicateStarts(workspace, keep);
    rejectNonInstanceRootNext(keep);
  });
}

export function isSchemaOrGenericRoot(block: { type: string }): boolean {
  return block.type === "target_structure" ||
    block.type.startsWith("schema_") ||
    block.type === "json_object" ||
    block.type === "xml_element";
}
