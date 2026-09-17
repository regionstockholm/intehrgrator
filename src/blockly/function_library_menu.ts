/**
 * Blockly context menu: Save / Contribute a Function definition.
 */

import { Blockly } from "./blockly_core.ts";
import { detectLocale, msg } from "./i18n/locale.ts";
import { isProcedureDefType } from "../core/function_library/blockly_json.ts";

export const SAVE_FUNCTION_MENU_ID = "intehrgrator_save_function";
export const CONTRIBUTE_FUNCTION_MENU_ID = "intehrgrator_contribute_function";

const MENU_PATCHED = "__intehrFunctionLibraryMenu";

type ContextMenuOption = {
  text?: string;
  enabled?: boolean;
  callback?: () => void;
  weight?: number;
};

type GenerateContextMenuFn = (this: Blockly.Block) => ContextMenuOption[] | null;

export interface FunctionLibraryMenuHandlers {
  save: (name: string) => void;
  contribute: (name: string) => void;
}

function isProcedureDef(block: Blockly.Block | null | undefined): block is Blockly.Block {
  return Boolean(
    block &&
      isProcedureDefType(block.type) &&
      String(block.getFieldValue("NAME") || "").trim(),
  );
}

function procedureName(block: Blockly.Block): string {
  return String(block.getFieldValue("NAME") || "").trim();
}

function contextMenuRegistry(): {
  registry: { getItem: (id: string) => unknown; register: (item: Record<string, unknown>) => void };
  ScopeType: { BLOCK: string };
} | null {
  const candidates = [
    Blockly.ContextMenuRegistry,
    (Blockly as unknown as { default?: { ContextMenuRegistry?: typeof Blockly.ContextMenuRegistry } })
      .default?.ContextMenuRegistry,
  ];
  for (const candidate of candidates) {
    if (candidate?.registry) {
      return candidate as unknown as {
        registry: { getItem: (id: string) => unknown; register: (item: Record<string, unknown>) => void };
        ScopeType: { BLOCK: string };
      };
    }
  }
  return null;
}

export function registerFunctionLibraryMenus(handlers: FunctionLibraryMenuHandlers): void {
  const ctx = contextMenuRegistry();
  if (!ctx) return;
  if (!ctx.registry.getItem(SAVE_FUNCTION_MENU_ID)) {
    ctx.registry.register({
      id: SAVE_FUNCTION_MENU_ID,
      scopeType: ctx.ScopeType?.BLOCK ?? "block",
      weight: 7,
      displayText: () => msg(detectLocale()).SAVE_FUNCTION,
      preconditionFn: (scope: { block?: Blockly.Block }) =>
        isProcedureDef(scope.block) ? "enabled" : "hidden",
      callback: (scope: { block?: Blockly.Block }) => {
        if (scope.block && isProcedureDef(scope.block)) handlers.save(procedureName(scope.block));
      },
    });
  }
  if (!ctx.registry.getItem(CONTRIBUTE_FUNCTION_MENU_ID)) {
    ctx.registry.register({
      id: CONTRIBUTE_FUNCTION_MENU_ID,
      scopeType: ctx.ScopeType?.BLOCK ?? "block",
      weight: 8,
      displayText: () => msg(detectLocale()).CONTRIBUTE_FUNCTION,
      preconditionFn: (scope: { block?: Blockly.Block }) =>
        isProcedureDef(scope.block) ? "enabled" : "hidden",
      callback: (scope: { block?: Blockly.Block }) => {
        if (scope.block && isProcedureDef(scope.block)) {
          handlers.contribute(procedureName(scope.block));
        }
      },
    });
  }
}

export function installFunctionLibraryMenus(
  workspace: Blockly.Workspace,
  handlers: FunctionLibraryMenuHandlers,
): void {
  registerFunctionLibraryMenus(handlers);
  const proto = blockSvgPrototypeOf(workspace) as
    | (object & { generateContextMenu?: GenerateContextMenuFn; [MENU_PATCHED]?: boolean })
    | null;
  if (!proto || typeof proto.generateContextMenu !== "function") return;
  if (proto[MENU_PATCHED]) return;
  const original = proto.generateContextMenu;
  proto.generateContextMenu = function (this: Blockly.Block) {
    const menu = original.call(this) ?? [];
    if (!isProcedureDef(this)) return menu;
    const locale = detectLocale();
    const saveLabel = msg(locale).SAVE_FUNCTION;
    const contributeLabel = msg(locale).CONTRIBUTE_FUNCTION;
    const name = procedureName(this);
    if (!menu.some((item) => item.text === saveLabel)) {
      menu.push({
        text: saveLabel,
        enabled: true,
        callback: () => handlers.save(name),
        weight: 7,
      });
    }
    if (!menu.some((item) => item.text === contributeLabel)) {
      menu.push({
        text: contributeLabel,
        enabled: true,
        callback: () => handlers.contribute(name),
        weight: 8,
      });
    }
    return menu;
  };
  proto[MENU_PATCHED] = true;
}

function blockSvgPrototypeOf(workspace: Blockly.Workspace): object | null {
  const BlockSvg = (Blockly as unknown as { BlockSvg?: { prototype: object } }).BlockSvg;
  if (BlockSvg?.prototype) return BlockSvg.prototype;
  const existing = workspace.getAllBlocks(false)[0];
  if (existing) return Object.getPrototypeOf(existing) as object;
  return null;
}
