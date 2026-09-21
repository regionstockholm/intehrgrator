/**
 * Unique canvas **default context map**: runtime key + scaffold-target chips + value.
 */
import { Blockly } from "../blockly_core.ts";
import {
  DEFAULT_CONTEXT_MAP_TYPE,
} from "../../core/defaults/extract.ts";
import { parseTargetsField } from "../../core/defaults/context_map.ts";
import { appendMutatorCogwheel, hideDefaultMutatorIcon } from "../dynamic_mutator.ts";
import { enforceMouthCaptionLayout, initMutatorStackMouth } from "../mouth_layout.ts";
import { FieldScaffoldTargets, registerFieldScaffoldTargets } from "../field_scaffold_targets.ts";

const COLOUR = "#5C6BC0";
export const DEFAULT_CONTEXT_MAP_ITEM = "default_context_map_item";
export const DEFAULT_CONTEXT_MAP_CONTAINER = "default_context_map_container";

const FOLDER_SVG = "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><path d="M2 5h5l1 1.5H16v8.5H2z" fill="#fff" stroke="#5f6368"/><path d="M2 6.5h14" stroke="#5f6368"/></svg>',
  );
const INFO_SVG = "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="7.5" fill="#fff" stroke="#005c53"/><text x="9" y="13" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-weight="700" font-size="12" fill="#005c53">i</text></svg>',
  );
const HARDCODE_SVG = "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><rect x="3.5" y="7" width="11" height="8" rx="1.5" fill="#fff" stroke="#5f6368"/><path d="M6 7V5.5a3 3 0 0 1 6 0V7" fill="none" stroke="#5f6368" stroke-width="1.4"/><circle cx="9" cy="11.5" r="1.2" fill="#5f6368"/></svg>',
  );
const APPLY_SVG = "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="7.5" fill="#fff" stroke="#005c53"/><path d="M5 9.2 8 12l5-6" fill="none" stroke="#005c53" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  );

let pickHandler: (() => void) | null = null;
let infoHandler: ((anchor: Element | null) => void) | null = null;
let hardcodeHandler: (() => void) | null = null;
let applyHandler: (() => void) | null = null;

type ClickableField = {
  getClickTarget_?: () => Element | null;
  getSvgRoot?: () => SVGElement | null;
  fieldGroup_?: Element | null;
};

function fieldClickAnchor(field: ClickableField): Element | null {
  return field.getClickTarget_?.() ?? field.getSvgRoot?.() ?? field.fieldGroup_ ?? null;
}

export function setDefaultsMapPickHandler(handler: (() => void) | null): void {
  pickHandler = handler;
}
export function setDefaultsMapInfoHandler(handler: ((anchor: Element | null) => void) | null): void {
  infoHandler = handler;
}
export function setDefaultsMapHardcodeHandler(handler: (() => void) | null): void {
  hardcodeHandler = handler;
}
export function setDefaultContextMapApplyHandler(handler: (() => void) | null): void {
  applyHandler = handler;
}

type ContextMapBlock = Blockly.Block & {
  itemCount_: number;
  updateShape_: () => void;
};

function inputAlignRight(): number {
  return (Blockly.inputs?.Align?.RIGHT ?? Blockly.ALIGN_RIGHT ?? 1) as number;
}

function keyField(defaultText = ""): Blockly.FieldTextInput {
  return new Blockly.FieldTextInput(defaultText, undefined, { spellcheck: false });
}

function removePairInputs(block: ContextMapBlock, index: number): void {
  block.removeInput(`VAL${index}`, true);
}

function hasPairInput(block: ContextMapBlock, index: number): boolean {
  return !!block.getInput(`VAL${index}`);
}

function updateContextMapShape(block: ContextMapBlock): void {
  if (block.itemCount_ === 0) {
    let i = 0;
    while (hasPairInput(block, i)) {
      removePairInputs(block, i);
      i++;
    }
    if (!block.getInput("EMPTY")) {
      block.appendDummyInput("EMPTY").appendField("no entries — add via cogwheel or New");
    }
  } else {
    if (block.getInput("EMPTY")) block.removeInput("EMPTY");
    let i = block.itemCount_;
    while (hasPairInput(block, i)) {
      removePairInputs(block, i);
      i++;
    }
    for (let n = 0; n < block.itemCount_; n++) {
      if (block.getInput(`VAL${n}`)) continue;
      const input = block.appendValueInput(`VAL${n}`)
        .setAlign(inputAlignRight())
        .appendField(keyField(""), `KEY${n}`)
        .appendField(new FieldScaffoldTargets("[]"), `TARGETS${n}`)
        .appendField(":");
      input.setCheck(null);
      if (
        input.connection &&
        typeof input.connection.setShadowState === "function" &&
        Blockly.Blocks["text"]
      ) {
        input.connection.setShadowState({
          type: "text",
          fields: { TEXT: "" },
        });
      }
    }
  }

  const order = ["HEADER"];
  for (let n = 0; n < block.itemCount_; n++) order.push(`VAL${n}`);
  if (block.getInput("EMPTY")) order.push("EMPTY");
  for (const name of order) {
    if (block.getInput(name)) block.moveInputBefore(name, null);
  }
  enforceMouthCaptionLayout(block);
}

function defineMutatorQuarks(): void {
  if (!Blockly.Blocks[DEFAULT_CONTEXT_MAP_CONTAINER]) {
    Blockly.Blocks[DEFAULT_CONTEXT_MAP_CONTAINER] = {
      init: function (this: Blockly.Block) {
        initMutatorStackMouth(this, "entries");
        this.setColour(COLOUR);
        this.contextMenu = false;
      },
    };
  }
  if (!Blockly.Blocks[DEFAULT_CONTEXT_MAP_ITEM]) {
    Blockly.Blocks[DEFAULT_CONTEXT_MAP_ITEM] = {
      init: function (this: Blockly.Block) {
        this.appendDummyInput().appendField("entry");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(COLOUR);
        this.contextMenu = false;
      },
    };
  }
}

type MutatorItemBlock = Blockly.Block & {
  valueConnection_?: Blockly.Connection | null;
  targetsJson_?: string;
  keyValue_?: string;
};

const contextMapMutator = {
  itemCount_: 0,
  mutationToDom: function (this: ContextMapBlock) {
    const xml = Blockly.utils.xml.createElement("mutation");
    xml.setAttribute("items", String(this.itemCount_));
    return xml;
  },
  domToMutation: function (this: ContextMapBlock, xml: Element) {
    this.itemCount_ = Math.max(0, Number(xml.getAttribute("items") ?? 0));
    this.updateShape_();
  },
  saveExtraState: function (this: ContextMapBlock) {
    const targets: string[][] = [];
    for (let i = 0; i < this.itemCount_; i++) {
      const field = this.getField(`TARGETS${i}`) as FieldScaffoldTargets | null;
      targets.push(field?.getTargets() ?? parseTargetsField(this.getFieldValue(`TARGETS${i}`)));
    }
    return { itemCount: this.itemCount_, targets };
  },
  loadExtraState: function (
    this: ContextMapBlock,
    state: { itemCount?: number; targets?: string[][] } | string | null,
  ) {
    let itemCount = 0;
    let targets: string[][] = [];
    if (state == null || state === "") {
      itemCount = 0;
    } else if (typeof state === "string") {
      const parsed = JSON.parse(state) as { itemCount?: number; targets?: string[][] };
      itemCount = Number(parsed?.itemCount ?? 0);
      targets = parsed?.targets ?? [];
    } else {
      itemCount = Number(state.itemCount ?? 0);
      targets = state.targets ?? [];
    }
    this.itemCount_ = itemCount;
    this.updateShape_();
    for (let i = 0; i < this.itemCount_; i++) {
      const field = this.getField(`TARGETS${i}`) as FieldScaffoldTargets | null;
      const chips = targets[i] ?? parseTargetsField(this.getFieldValue(`TARGETS${i}`));
      field?.setTargets(chips);
    }
  },
  decompose: function (this: ContextMapBlock, workspace: Blockly.Workspace) {
    defineMutatorQuarks();
    const container = workspace.newBlock(DEFAULT_CONTEXT_MAP_CONTAINER);
    (container as Blockly.Block & { initSvg?: () => void }).initSvg?.();
    let connection = container.getInput("STACK")?.connection ?? null;
    for (let i = 0; i < this.itemCount_; i++) {
      const item = workspace.newBlock(DEFAULT_CONTEXT_MAP_ITEM);
      (item as Blockly.Block & { initSvg?: () => void }).initSvg?.();
      if (connection && item.previousConnection) {
        connection.connect(item.previousConnection);
        connection = item.nextConnection;
      }
    }
    return container;
  },
  compose: function (this: ContextMapBlock, container: Blockly.Block) {
    let item = container.getInputTargetBlock("STACK") as MutatorItemBlock | null;
    const connections: Array<Blockly.Connection | null> = [];
    const keys: string[] = [];
    const targets: string[] = [];
    while (item && !item.isInsertionMarker()) {
      connections.push(item.valueConnection_ ?? null);
      keys.push(item.keyValue_ ?? "");
      targets.push(item.targetsJson_ ?? "[]");
      item = item.getNextBlock() as MutatorItemBlock | null;
    }
    for (let i = 0; i < this.itemCount_; i++) {
      const conn = this.getInput(`VAL${i}`)?.connection?.targetConnection ?? null;
      if (conn && !connections.includes(conn)) conn.disconnect();
    }
    this.itemCount_ = connections.length;
    this.updateShape_();
    for (let i = 0; i < this.itemCount_; i++) {
      const saved = connections[i];
      if (saved) this.getInput(`VAL${i}`)?.connection?.connect(saved);
      if (keys[i]) this.setFieldValue(keys[i], `KEY${i}`);
      const field = this.getField(`TARGETS${i}`) as FieldScaffoldTargets | null;
      field?.setTargets(parseTargetsField(targets[i]));
    }
  },
  saveConnections: function (this: ContextMapBlock, container: Blockly.Block) {
    let item = container.getInputTargetBlock("STACK") as MutatorItemBlock | null;
    let i = 0;
    while (item) {
      if (!item.isInsertionMarker()) {
        const input = this.getInput(`VAL${i}`);
        item.valueConnection_ = input?.connection?.targetConnection ?? null;
        item.keyValue_ = String(this.getFieldValue(`KEY${i}`) ?? "");
        const field = this.getField(`TARGETS${i}`) as FieldScaffoldTargets | null;
        item.targetsJson_ = JSON.stringify(field?.getTargets() ?? []);
        i++;
      }
      item = item.getNextBlock() as MutatorItemBlock | null;
    }
  },
};

export function registerDefaultContextMapBlock(): void {
  registerFieldScaffoldTargets();
  defineMutatorQuarks();

  Blockly.Blocks[DEFAULT_CONTEXT_MAP_TYPE] = {
    ...contextMapMutator,
    init: function (this: ContextMapBlock) {
      this.itemCount_ = 0;
      let infoField: Blockly.FieldImage;
      infoField = new Blockly.FieldImage(
        INFO_SVG,
        18,
        18,
        "Default context map: runtime keys for convert-time defaults; scaffold-target chips light Default points. Folder: load or save. Check: Apply structure.",
        () => {
          infoHandler?.(fieldClickAnchor(infoField as ClickableField));
        },
      );
      const header = this.appendDummyInput("HEADER");
      header.appendField("Default context map")
        .appendField(
          new Blockly.FieldImage(FOLDER_SVG, 18, 18, "Load/save", () => {
            pickHandler?.();
          }),
        )
        .appendField(
          new Blockly.FieldImage(
            APPLY_SVG,
            18,
            18,
            "Apply default context map (join Default points)",
            () => {
              applyHandler?.();
            },
          ),
        )
        .appendField(
          new Blockly.FieldImage(
            HARDCODE_SVG,
            18,
            18,
            "Hardcode: inline a map entry into canvas lookups",
            () => {
              hardcodeHandler?.();
            },
          ),
        )
        .appendField(infoField);
      appendMutatorCogwheel(header);
      this.setColour(COLOUR);
      this.setTooltip(
        "Convert-time defaults table. Lookups use maps_get(\"defaults\", runtime key). Scaffold targets are authoring-only.",
      );
      this.setDeletable(false);
      this.setMovable(true);
      this.setInputsInline(false);
      this.updateShape_();
      this.setMutator(
        new Blockly.icons.MutatorIcon(
          [DEFAULT_CONTEXT_MAP_ITEM],
          this as unknown as import("blockly/core").BlockSvg,
        ),
      );
      hideDefaultMutatorIcon(this);
    },
    updateShape_: function (this: ContextMapBlock) {
      updateContextMapShape(this);
    },
  };
}

export function contextMapItemCount(block: Blockly.Block): number {
  return Number(
    (block as ContextMapBlock).itemCount_ ??
      (() => {
        let n = 0;
        while (block.getInput(`VAL${n}`) || block.getField(`KEY${n}`)) n++;
        return n;
      })(),
  );
}

export function appendContextMapEntry(
  block: Blockly.Block,
  runtimeKey: string,
  targets: string[],
): number {
  const map = block as ContextMapBlock;
  const index = map.itemCount_ ?? contextMapItemCount(block);
  map.itemCount_ = index + 1;
  map.updateShape_();
  if (runtimeKey) map.setFieldValue(runtimeKey, `KEY${index}`);
  const field = map.getField(`TARGETS${index}`) as FieldScaffoldTargets | null;
  field?.setTargets(targets);
  return index;
}

export function scaffoldTargetFieldAtClientPoint(
  workspace: Blockly.Workspace,
  clientX: number,
  clientY: number,
): FieldScaffoldTargets | null {
  for (const block of workspace.getAllBlocks(false)) {
    if (block.type !== DEFAULT_CONTEXT_MAP_TYPE) continue;
    const count = contextMapItemCount(block);
    for (let i = 0; i < count; i++) {
      const field = block.getField(`TARGETS${i}`) as FieldScaffoldTargets | null;
      const rect = field?.getClientRect();
      if (!rect) continue;
      if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
        return field;
      }
    }
  }
  return null;
}

export function defaultContextMapAtClientPoint(
  workspace: Blockly.Workspace,
  clientX: number,
  clientY: number,
): Blockly.Block | null {
  for (const block of workspace.getTopBlocks(false)) {
    if (block.type !== DEFAULT_CONTEXT_MAP_TYPE) continue;
    const svg = block as Blockly.Block & { getSvgRoot?: () => SVGElement | null };
    const root = svg.getSvgRoot?.();
    const rect = root?.getBoundingClientRect();
    if (!rect) continue;
    if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
      return block;
    }
  }
  return null;
}

export function contextMapValueInputAtClientPoint(
  workspace: Blockly.Workspace,
  clientX: number,
  clientY: number,
): { block: Blockly.Block; index: number } | null {
  for (const block of workspace.getAllBlocks(false)) {
    if (block.type !== DEFAULT_CONTEXT_MAP_TYPE) continue;
    const count = contextMapItemCount(block);
    for (let i = 0; i < count; i++) {
      const input = block.getInput(`VAL${i}`);
      const conn = input?.connection as
        | { x?: number; y?: number; offsetInBlock?: { x: number; y: number } }
        | undefined;
      if (!conn) continue;
      const svg = block as Blockly.Block & {
        getSvgRoot?: () => SVGElement | null;
        workspace?: { scale?: number };
      };
      const root = svg.getSvgRoot?.();
      if (!root) continue;
      const origin = root.getBoundingClientRect();
      const scale = Number(svg.workspace?.scale ?? 1) || 1;
      const ox = Number(conn.offsetInBlock?.x ?? conn.x ?? 0);
      const oy = Number(conn.offsetInBlock?.y ?? conn.y ?? 0);
      const x = origin.left + ox * scale;
      const y = origin.top + oy * scale;
      if (Math.abs(clientX - x) < 48 && Math.abs(clientY - y) < 22) {
        return { block, index: i };
      }
    }
  }
  return null;
}
