/**
 * Blockly context-menu refactoring: extract a block subtree into a function
 * (`procedures_defreturn` / `procedures_defnoreturn`) and leave a call in place.
 *
 * Blockly procedure *call* blocks run `renameProcedure` → tooltip `.replace`
 * on stock `Msg.PROCEDURES_CALL*RETURN_TOOLTIP`. Headless tests (and any
 * workspace created before `loadBlocklyLocale`) may lack those keys; fill
 * them before creating a call so extract cannot crash on i18n.
 */

import { Blockly } from "./blockly_core.ts";
import { withBlocklyUndoGroup } from "./blockly_events.ts";
import { detectLocale, msg } from "./i18n/locale.ts";

export const EXTRACT_TO_FUNCTION_MENU_ID = "intehrgrator_extract_to_function";

const PROCEDURE_CALL_MSG: Record<string, string> = {
  PROCEDURES_CALLRETURN_TOOLTIP:
    "Run the user-defined function '%1' and use its output.",
  PROCEDURES_CALLNORETURN_TOOLTIP: "Run the user-defined function '%1'.",
  PROCEDURES_CALL_DISABLED_DEF_WARNING:
    "Can't run the user-defined function '%1' because the definition block is disabled.",
};

function ensureProcedureCallMessages(): void {
  const Msg = (Blockly as unknown as { Msg?: Record<string, string | undefined> }).Msg;
  if (!Msg) return;
  for (const [key, fallback] of Object.entries(PROCEDURE_CALL_MSG)) {
    if (!Msg[key]) Msg[key] = fallback;
  }
}

const PROCEDURE_TYPES = new Set([
  "procedures_defnoreturn",
  "procedures_defreturn",
  "procedures_callnoreturn",
  "procedures_callreturn",
  "procedures_ifreturn",
]);

export function canExtractToFunction(block: Blockly.Block | null | undefined): boolean {
  if (!block || block.isInFlyout || block.isShadow?.()) return false;
  if (block.workspace?.options?.readOnly) return false;
  if (typeof block.isMovable === "function" && !block.isMovable()) return false;
  if (PROCEDURE_TYPES.has(block.type)) return false;
  return Boolean(block.outputConnection || block.previousConnection);
}

/**
 * Replace `block` with a procedure call and move the subtree onto a new
 * function definition. Returns the call block.
 */
export function extractBlockToFunction(
  block: Blockly.Block,
  nameHint = "helper",
): Blockly.Block {
  if (!canExtractToFunction(block)) {
    throw new Error("Block cannot be extracted to a function");
  }
  ensureProcedureCallMessages();
  const workspace = block.workspace;
  const hasOutput = Boolean(block.outputConnection);
  const defType = hasOutput ? "procedures_defreturn" : "procedures_defnoreturn";
  const callType = hasOutput ? "procedures_callreturn" : "procedures_callnoreturn";
  const parentConnection = hasOutput
    ? block.outputConnection?.targetConnection
    : block.previousConnection?.targetConnection;

  let call!: Blockly.Block;
  withBlocklyUndoGroup(() => {
    const def = workspace.newBlock(defType);
    const name = Blockly.Procedures.findLegalName(nameHint, def);
    def.setFieldValue(name, "NAME");
    const xy = typeof block.getRelativeToSurfaceXY === "function"
      ? block.getRelativeToSurfaceXY()
      : { x: 0, y: 0 };
    if (typeof def.moveBy === "function") {
      def.moveBy((xy.x ?? 0) + 240, xy.y ?? 0);
    }

    block.unplug(true);

    const bodyInput = hasOutput
      ? (def.getInput("RETURN") ?? def.getInput("VALUE"))
      : (def.getInput("STACK") ?? def.getInput("STATEMENT_INPUT"));
    const bodyConn = bodyInput?.connection;
    if (hasOutput && block.outputConnection && bodyConn) {
      bodyConn.connect(block.outputConnection);
    } else if (!hasOutput && block.previousConnection && bodyConn) {
      bodyConn.connect(block.previousConnection);
    }
    initAndRender(def);

    call = createProcedureCall(workspace, callType, name);
    if (parentConnection) {
      if (hasOutput && call.outputConnection) {
        parentConnection.connect(call.outputConnection);
      } else if (!hasOutput && call.previousConnection) {
        parentConnection.connect(call.previousConnection);
      }
    }
    initAndRender(call);
  });
  return call;
}

export function registerExtractToFunctionMenu(): void {
  const registry = Blockly.ContextMenuRegistry?.registry;
  if (!registry) return;
  if (registry.getItem(EXTRACT_TO_FUNCTION_MENU_ID)) return;
  registry.register({
    id: EXTRACT_TO_FUNCTION_MENU_ID,
    scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
    weight: 6,
    displayText: () => msg(detectLocale()).EXTRACT_TO_FUNCTION,
    preconditionFn: (scope) => canExtractToFunction(scope.block) ? "enabled" : "hidden",
    callback: (scope) => {
      if (scope.block) extractBlockToFunction(scope.block);
    },
  });
}

function createProcedureCall(
  workspace: Blockly.Workspace,
  callType: string,
  name: string,
): Blockly.Block {
  const disabled = typeof Blockly.Events.disable === "function";
  if (disabled) Blockly.Events.disable();
  try {
    const call = workspace.newBlock(callType);
    // NAME is enough for a no-arg call. Avoid `domToMutation`/`loadExtraState`:
    // those always hit `renameProcedure`, which `.replace`s stock Blockly
    // tooltip messages that are missing until `loadBlocklyLocale`.
    call.setFieldValue(name, "NAME");
    const tooltipKey = call.outputConnection
      ? "PROCEDURES_CALLRETURN_TOOLTIP"
      : "PROCEDURES_CALLNORETURN_TOOLTIP";
    const Msg = (Blockly as unknown as { Msg?: Record<string, string | undefined> }).Msg;
    const template = Msg?.[tooltipKey];
    if (template && typeof call.setTooltip === "function") {
      call.setTooltip(template.replace("%1", name));
    }
    return call;
  } finally {
    if (disabled) Blockly.Events.enable();
  }
}

function initAndRender(block: Blockly.Block): void {
  const svg = block as Blockly.Block & { initSvg?: () => void; render?: () => void };
  svg.initSvg?.();
  svg.render?.();
}
