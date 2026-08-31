/**
 * Cogwheel mutator for target_structure — optional schema fields (JSON/XSD targets).
 */

import type { Block, BlockSvg } from "blockly/core";
import { Blockly } from "../blockly_core.ts";
import { optionalSchemaChildren } from "../schema_catalog.ts";
import {
  appendMutatorCogwheel,
  namesFromMutatorStack,
  registerDynamicFlyoutMutator,
  type MutatorFlyoutBlock,
} from "../dynamic_mutator.ts";
import { applyMutatorItemLabel } from "./rm_blocks.ts";
import { presentTargetFieldNames, syncTargetChildInputs, targetChildInputName } from "./target_blocks.ts";

const TARGET_CHILD_PREFIX = "TARGET_";

export const SCHEMA_FIELDS_MUTATOR = "schema_fields_mutator";
export const SCHEMA_MUTATOR_CONTAINER = "schema_fields_mutator_container";
export const SCHEMA_MUTATOR_ITEM = "schema_fields_mutator_item";
const SCHEMA_OPTIONAL_PREFIX = "SCHEMA_OPT_";

export type SchemaMutatorChange = {
  parent: Block;
  added: string[];
  removed: string[];
};

let changeHandler: ((change: SchemaMutatorChange) => void) | null = null;

export function setSchemaFieldsMutatorChangeHandler(
  handler: ((change: SchemaMutatorChange) => void) | null,
): void {
  changeHandler = handler;
}

export function schemaOptionalInputName(name: string): string {
  return `${SCHEMA_OPTIONAL_PREFIX}${name}`;
}

export function isSchemaOptionalInput(name: string): boolean {
  return name.startsWith(SCHEMA_OPTIONAL_PREFIX);
}

function targetChildGroups(block: Block): string[] {
  return block.inputList
    .filter((input) => input.name.startsWith(TARGET_CHILD_PREFIX))
    .map((input) => input.name.slice(TARGET_CHILD_PREFIX.length));
}

function restoreTargetStructureState(
  block: Block,
  state: { childGroups?: string[]; extras?: string[]; attrs?: string[] } | null,
): void {
  const childGroups = Array.isArray(state?.childGroups)
    ? state!.childGroups!.filter((group) => typeof group === "string" && group.length > 0)
    : [];
  syncTargetChildInputs(block, childGroups);
  block.schemaExtraFields_ = Array.isArray(state?.extras) ? state!.extras! : [];
  block.updateSchemaFields_?.();
}

function defineSchemaMutatorQuarks(): void {
  if (!Blockly.Blocks[SCHEMA_MUTATOR_CONTAINER]) {
    Blockly.Blocks[SCHEMA_MUTATOR_CONTAINER] = {
      init: function (this: Block) {
        this.appendDummyInput().appendField("optional fields");
        this.appendStatementInput("STACK");
        this.setColour("#4B5563");
        this.contextMenu = false;
      },
    };
  }
  if (!Blockly.Blocks[SCHEMA_MUTATOR_ITEM]) {
    Blockly.Blocks[SCHEMA_MUTATOR_ITEM] = {
      init: function (this: Block) {
        this.appendDummyInput().appendField(
          new Blockly.FieldLabelSerializable(""),
          "LABEL",
        );
        this.appendDummyInput()
          .appendField(new Blockly.FieldLabelSerializable(""), "ATTR");
        this.getField("ATTR")!.setVisible(false);
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour("#4B5563");
        this.contextMenu = false;
      },
      loadExtraState: function (this: Block, state: { attr?: string; label?: string }) {
        if (state?.attr) applyMutatorItemLabel(this, state.attr, state.label ?? state.attr);
      },
    };
  }
}

function schemaMutatorChoices(block: Block): Array<[string, string]> {
  const slotId = String(block.getFieldValue("SLOT_ID") ?? "");
  const present = new Set(presentTargetFieldNames(block));
  return optionalSchemaChildren(slotId)
    .filter((child) => !present.has(child.rmAttribute ?? child.label))
    .map((child) => {
      const name = child.rmAttribute ?? child.label;
      return [child.label, name] as [string, string];
    });
}

function stackMutatorItems(
  workspace: Blockly.Workspace,
  names: string[],
  labels: Map<string, string>,
): Block {
  const container = workspace.newBlock(SCHEMA_MUTATOR_CONTAINER);
  container.initSvg?.();
  let connection = container.getInput("STACK")?.connection ?? null;
  for (const name of names) {
    const item = workspace.newBlock(SCHEMA_MUTATOR_ITEM);
    item.initSvg?.();
    applyMutatorItemLabel(item, name, labels.get(name) ?? name);
    if (connection && item.previousConnection) {
      connection.connect(item.previousConnection);
      connection = item.nextConnection;
    }
  }
  return container;
}

function bindSchemaMutator(this: Block): void {
  const header = this.getInput("HEADER");
  if (header) appendMutatorCogwheel(header);
}

function buildSchemaFlyoutContents(
  block: Block,
  stackNames: string[],
): MutatorFlyoutBlock[] {
  return schemaMutatorChoices(block)
    .filter(([, name]) => name && !stackNames.includes(name))
    .map(([label, name]) => ({
      kind: "block" as const,
      type: SCHEMA_MUTATOR_ITEM,
      extraState: { attr: name, label },
    }));
}

let registered = false;

export function registerSchemaFieldsMutator(): void {
  if (registered) return;
  registered = true;
  defineSchemaMutatorQuarks();
  registerDynamicFlyoutMutator(
    SCHEMA_FIELDS_MUTATOR,
    {
      mutationToDom: function (this: Block) {
        const xml = Blockly.utils.xml.createElement("mutation");
        const childGroups = targetChildGroups(this);
        if (childGroups.length) xml.setAttribute("childGroups", JSON.stringify(childGroups));
        xml.setAttribute("extras", JSON.stringify(this.schemaExtraFields_ ?? []));
        xml.setAttribute("attrs", JSON.stringify(presentTargetFieldNames(this)));
        return xml;
      },
      domToMutation: function (this: Block, xmlElement: Element) {
        const childGroups = JSON.parse(xmlElement.getAttribute("childGroups") || "[]") as string[];
        this.schemaExtraFields_ = JSON.parse(xmlElement.getAttribute("extras") || "[]") as string[];
        restoreTargetStructureState(this, { childGroups, extras: this.schemaExtraFields_ });
      },
      saveExtraState: function (this: Block) {
        const childGroups = targetChildGroups(this);
        const extras = this.schemaExtraFields_ ?? [];
        const payload = {
          childGroups,
          extras,
          attrs: presentTargetFieldNames(this),
        };
        return childGroups.length || extras.length ? payload : null;
      },
      loadExtraState: function (
        this: Block,
        state: { childGroups?: string[]; extras?: string[]; attrs?: string[] } | string | null,
      ) {
        if (state == null || state === "") {
          restoreTargetStructureState(this, null);
          return;
        }
        const obj = typeof state === "string"
          ? JSON.parse(state) as { childGroups?: string[]; extras?: string[]; attrs?: string[] }
          : state;
        restoreTargetStructureState(this, obj);
      },
      decompose: function (this: Block, workspace: Blockly.Workspace) {
        const labels = new Map(schemaMutatorChoices(this).map(([label, name]) => [name, label]));
        return stackMutatorItems(workspace, this.schemaExtraFields_ ?? [], labels);
      },
      compose: function (this: Block, container: Block) {
        const next = namesFromMutatorStack(container);
        const prev = [...(this.schemaExtraFields_ ?? [])];
        const connections = new Map<string, Blockly.Connection | null>();
        let item: Block | null = container.getInputTargetBlock("STACK");
        while (item) {
          if (!item.isInsertionMarker()) {
            const name = String(item.getFieldValue("ATTR") || "");
            if (name) connections.set(name, item.savedConnection_ ?? null);
          }
          item = item.getNextBlock();
        }
        this.schemaExtraFields_ = next;
        this.updateSchemaFields_?.();
        for (const name of next) {
          connections.get(name)?.reconnect(this, schemaOptionalInputName(name));
        }
        const added = next.filter((name) => !prev.includes(name));
        const removed = prev.filter((name) => !next.includes(name));
        if (added.length || removed.length) {
          changeHandler?.({ parent: this, added, removed });
        }
      },
      saveConnections: function (this: Block, container: Block) {
        let item: Block | null = container.getInputTargetBlock("STACK");
        while (item) {
          if (!item.isInsertionMarker()) {
            const name = String(item.getFieldValue("ATTR") || "");
            const input = this.getInput(schemaOptionalInputName(name));
            item.savedConnection_ = input?.connection?.targetConnection ?? null;
          }
          item = item.getNextBlock();
        }
      },
      updateSchemaFields_: function (this: Block) {
        for (const input of [...this.inputList]) {
          if (input.name.startsWith(SCHEMA_OPTIONAL_PREFIX)) {
            this.removeInput(input.name);
          }
        }
        for (const name of this.schemaExtraFields_ ?? []) {
          this.appendStatementInput(schemaOptionalInputName(name)).appendField(name);
        }
      },
    },
    bindSchemaMutator,
    buildSchemaFlyoutContents,
    (block: BlockSvg) => block.schemaExtraFields_ ?? [],
  );
}

declare module "blockly/core" {
  interface Block {
    schemaExtraFields_?: string[];
    updateSchemaFields_?: () => void;
  }
}

export { targetChildInputName };

export function schemaOptionalExtrasOf(block: Block): string[] {
  return block.schemaExtraFields_ ?? [];
}

/** Apply a mutator stack of optional schema fields (tests and workbench seam). */
export function composeSchemaOptionalFields(block: Block, names: string[]): void {
  if (!block.decompose || !block.compose) return;
  const bubble = new Blockly.Workspace();
  try {
    const container = block.decompose(bubble);
    let item: Block | null = container.getInputTargetBlock("STACK");
    while (item) {
      const next = item.getNextBlock();
      item.dispose(false);
      item = next;
    }
    let connection = container.getInput("STACK")?.connection ?? null;
    const labels = new Map(schemaMutatorChoices(block).map(([label, name]) => [name, label]));
    for (const name of names) {
      const quark = bubble.newBlock(SCHEMA_MUTATOR_ITEM);
      quark.initSvg?.();
      applyMutatorItemLabel(quark, name, labels.get(name) ?? name);
      if (connection && quark.previousConnection) {
        connection.connect(quark.previousConnection);
        connection = quark.nextConnection;
      }
    }
    block.saveConnections?.(container);
    block.compose(container);
  } finally {
    bubble.dispose();
  }
}
