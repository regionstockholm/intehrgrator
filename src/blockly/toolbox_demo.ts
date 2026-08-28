/**
 * @license
 * Copyright 2022 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * Adapted from Blockly DevSite landing demo toolbox:
 * https://github.com/RaspberryPiFoundation/blockly-samples/blob/main/examples/devsite-landing-demo/toolbox.js
 *
 * intEHRgrator additions: Source + openEHR types (COMPOSITION / DATA_VALUE) categories, for_each_source in Loops.
 */

import type { BlocklyOptions } from "blockly/core";
import { dataValueLeafTypes, blockTypeForRm } from "../core/rm_meta.ts";
import type { SkeletonNode, TargetFormatId } from "../types/mod.ts";
import { msg } from "./i18n/custom_msg.ts";

export type ToolboxJson = NonNullable<BlocklyOptions["toolbox"]>;

export interface ToolboxContext {
  targetFormat?: TargetFormatId;
  skeleton?: SkeletonNode[];
}

function dataValueToolboxContents(): Array<{ kind: string; type: string }> {
  return dataValueLeafTypes().map((rmType) => ({
    kind: "block",
    type: blockTypeForRm(rmType),
  }));
}

function termPickShadow(setId: string, code?: string) {
  const fields: Record<string, string> = { SET: setId };
  if (code) fields.CODE = code;
  return { shadow: { type: "term_pick", fields } };
}

function mapsCreateWithToolboxBlock(itemCount: number): Record<string, unknown> {
  const fields: Record<string, string> = {};
  const inputs: Record<string, unknown> = {};
  for (let i = 0; i < itemCount; i++) {
    fields[`KEY${i}`] = "";
    inputs[`VAL${i}`] = { shadow: { type: "text", fields: { TEXT: "" } } };
  }
  return {
    kind: "block",
    type: "maps_create_with",
    extraState: { itemCount },
    fields,
    inputs,
  };
}

function compositionToolboxBlock(): Record<string, unknown> {
  return {
    kind: "block",
    type: "composition",
    gap: 8,
    inputs: {
      ATTR_language: termPickShadow("ISO_639-1"),
      ATTR_territory: termPickShadow("ISO_3166-1"),
      ATTR_category: termPickShadow("openehr:composition_category", "433"),
      ATTR_composer: { block: { type: "party_identified" } },
    },
  };
}

function openEhrTypeToolboxContents(): Array<Record<string, unknown>> {
  return [
    compositionToolboxBlock(),
    { kind: "block", type: "section", gap: 8 },
    { kind: "block", type: "observation", gap: 8 },
    { kind: "block", type: "evaluation", gap: 8 },
    { kind: "block", type: "instruction", gap: 8 },
    { kind: "block", type: "action", gap: 8 },
    { kind: "block", type: "admin_entry", gap: 8 },
    { kind: "block", type: "generic_entry", gap: 8 },
    { kind: "block", type: "cluster", gap: 8 },
    { kind: "block", type: "element", gap: 8 },
    { kind: "block", type: "history", gap: 8 },
    { kind: "block", type: "event_context", gap: 8 },
    { kind: "block", type: "party_proxy", gap: 8 },
    { kind: "block", type: "party_self", gap: 8 },
    { kind: "block", type: "party_identified", gap: 8 },
    { kind: "block", type: "party_related", gap: 8 },
    { kind: "block", type: "item_tree", gap: 8 },
    { kind: "block", type: "term_pick", gap: 8 },
    { kind: "block", type: "code_phrase", gap: 8 },
    ...dataValueToolboxContents(),
  ];
}

function schemaFlyoutContents(
  skeleton: SkeletonNode[],
): Array<{ kind: string; type: string; fields?: Record<string, string>; gap?: number }> {
  const out: Array<{ kind: string; type: string; fields?: Record<string, string>; gap?: number }> = [];
  const walk = (node: SkeletonNode) => {
    const type = node.blockType === "target_value" || node.kind === "value"
      ? "target_value"
      : "target_structure";
    out.push({
      kind: "block",
      type,
      gap: 4,
      fields: {
        NAME: node.label,
        TARGET_TYPE: node.rmType,
        SLOT_ID: node.slotId,
      },
    });
    for (const child of node.children) walk(child);
  };
  for (const root of skeleton) walk(root);
  return out.slice(0, 40);
}

/** Build the workspace toolbox (Blockly demo + Source / openEHR types / JSON / XML). */
export function buildDemoToolbox(locale: string, context: ToolboxContext = {}): ToolboxJson {
  const m = msg(locale);
  const extraTargetCategories: Array<Record<string, unknown>> = [
    {
      kind: "category",
      name: m.CAT_JSON,
      colour: 40,
      cssconfig: { row: "blocklyToolboxCategory blocklyToolboxCategoryJson" },
      contents: [
        { kind: "block", type: "json_object", gap: 8 },
        { kind: "block", type: "json_array", gap: 8 },
        { kind: "block", type: "json_value", gap: 8 },
        { kind: "block", type: "target_structure", gap: 8 },
        { kind: "block", type: "target_value" },
      ],
    },
    {
      kind: "category",
      name: m.CAT_XML,
      colour: 200,
      cssconfig: { row: "blocklyToolboxCategory blocklyToolboxCategoryXml" },
      contents: [
        { kind: "block", type: "xml_element", gap: 8 },
        { kind: "block", type: "xml_text", gap: 8 },
        { kind: "block", type: "target_structure", gap: 8 },
        { kind: "block", type: "target_value" },
      ],
    },
  ];
  if (
    (context.targetFormat === "json-schema" || context.targetFormat === "xml-schema") &&
    context.skeleton?.length
  ) {
    extraTargetCategories.push({
      kind: "category",
      name: m.CAT_TARGET_SCHEMA,
      colour: 0,
      cssconfig: { row: "blocklyToolboxCategory blocklyToolboxCategoryTargetSchema" },
      contents: schemaFlyoutContents(context.skeleton),
    });
  }
  return {
    kind: "categoryToolbox",
    contents: [
      {
        kind: "search",
        name: m.CAT_SEARCH,
        contents: [],
        cssconfig: { row: "blocklyToolboxCategory blocklyToolboxCategorySearch" },
      },
      {
        kind: "category",
        name: m.CAT_SOURCE,
        colour: 28,
        cssconfig: { row: "blocklyToolboxCategory blocklyToolboxCategorySource" },
        contents: [
          { kind: "block", type: "source_query", gap: 8 },
          { kind: "block", type: "source_query_number", gap: 8 },
          { kind: "block", type: "source_query_boolean", gap: 8 },
          { kind: "block", type: "source_query_node", gap: 8 },
        ],
      },
      {
        kind: "category",
        name: m.CAT_OPENEHR_TYPES,
        colour: 230,
        cssconfig: { row: "blocklyToolboxCategory blocklyToolboxCategoryOpenEhrTypes" },
        contents: openEhrTypeToolboxContents(),
      },
      ...extraTargetCategories,
      {
        kind: "category",
        name: m.CAT_LOGIC,
        colour: 262,
        cssconfig: { row: "blocklyToolboxCategory blocklyToolboxCategoryLogic" },
        contents: [
          { kind: "block", type: "controls_if" },
          { kind: "block", type: "logic_compare" },
          { kind: "block", type: "logic_operation" },
          { kind: "block", type: "logic_negate" },
          { kind: "block", type: "logic_boolean" },
          { kind: "block", type: "logic_ternary" },
        ],
      },
      {
        kind: "category",
        name: m.CAT_LOOPS,
        colour: 122,
        cssconfig: { row: "blocklyToolboxCategory blocklyToolboxCategoryLoops" },
        contents: [
          {
            kind: "block",
            type: "controls_repeat_ext",
            inputs: {
              TIMES: {
                shadow: { type: "math_number", fields: { NUM: 10 } },
              },
            },
          },
          { kind: "block", type: "controls_whileUntil" },
          {
            kind: "block",
            type: "controls_for",
            inputs: {
              FROM: { shadow: { type: "math_number", fields: { NUM: 1 } } },
              TO: { shadow: { type: "math_number", fields: { NUM: 10 } } },
              BY: { shadow: { type: "math_number", fields: { NUM: 1 } } },
            },
          },
          { kind: "block", type: "controls_forEach" },
          { kind: "block", type: "for_each_source" },
          { kind: "block", type: "controls_flow_statements" },
        ],
      },
      {
        kind: "category",
        name: m.CAT_MATH,
        colour: 206,
        cssconfig: { row: "blocklyToolboxCategory blocklyToolboxCategoryMath" },
        contents: [
          { kind: "block", type: "math_number", fields: { NUM: 123 } },
          {
            kind: "block",
            type: "math_arithmetic",
            inputs: {
              A: { shadow: { type: "math_number", fields: { NUM: 1 } } },
              B: { shadow: { type: "math_number", fields: { NUM: 1 } } },
            },
          },
          {
            kind: "block",
            type: "math_single",
            inputs: {
              NUM: { shadow: { type: "math_number", fields: { NUM: 9 } } },
            },
          },
          {
            kind: "block",
            type: "math_number_property",
            inputs: {
              NUMBER_TO_CHECK: { shadow: { type: "math_number", fields: { NUM: 0 } } },
            },
          },
          {
            kind: "block",
            type: "math_round",
            inputs: {
              NUM: { shadow: { type: "math_number", fields: { NUM: 3.1 } } },
            },
          },
          { kind: "block", type: "math_on_list" },
          {
            kind: "block",
            type: "math_modulo",
            inputs: {
              DIVIDEND: { shadow: { type: "math_number", fields: { NUM: 64 } } },
              DIVISOR: { shadow: { type: "math_number", fields: { NUM: 10 } } },
            },
          },
          {
            kind: "block",
            type: "math_constrain",
            inputs: {
              VALUE: { shadow: { type: "math_number", fields: { NUM: 50 } } },
              LOW: { shadow: { type: "math_number", fields: { NUM: 1 } } },
              HIGH: { shadow: { type: "math_number", fields: { NUM: 100 } } },
            },
          },
          {
            kind: "block",
            type: "math_random_int",
            inputs: {
              FROM: { shadow: { type: "math_number", fields: { NUM: 1 } } },
              TO: { shadow: { type: "math_number", fields: { NUM: 100 } } },
            },
          },
          { kind: "block", type: "math_random_float" },
        ],
      },
      {
        kind: "category",
        name: m.CAT_TEXT,
        colour: 46,
        cssconfig: { row: "blocklyToolboxCategory blocklyToolboxCategoryText" },
        contents: [
          { kind: "block", type: "text" },
          {
            kind: "block",
            type: "text_code",
            fields: { LANG: "handlebars", TEXT: "" },
          },
          {
            kind: "block",
            type: "text_handlebars",
            inputs: {
              SCRIPT: {
                shadow: {
                  type: "text_code",
                  fields: { LANG: "handlebars", TEXT: "{{name}}" },
                },
              },
            },
          },
          { kind: "block", type: "text_join", extraState: { itemCount: 2 } },
          {
            kind: "block",
            type: "text_append",
            inputs: { TEXT: { shadow: { type: "text" } } },
          },
          {
            kind: "block",
            type: "text_length",
            inputs: {
              VALUE: {
                shadow: { type: "text", fields: { TEXT: "abc" } },
              },
            },
          },
          {
            kind: "block",
            type: "text_isEmpty",
            inputs: { VALUE: { shadow: { type: "text" } } },
          },
          {
            kind: "block",
            type: "text_indexOf",
            inputs: {
              VALUE: { shadow: { type: "text", fields: { TEXT: "abc" } } },
              FIND: { shadow: { type: "text", fields: { TEXT: "b" } } },
            },
          },
          {
            kind: "block",
            type: "text_charAt",
            inputs: {
              VALUE: { shadow: { type: "text", fields: { TEXT: "abc" } } },
            },
          },
          {
            kind: "block",
            type: "text_getSubstring",
            inputs: {
              STRING: { shadow: { type: "text", fields: { TEXT: "abc" } } },
            },
          },
          {
            kind: "block",
            type: "text_changeCase",
            inputs: {
              TEXT: { shadow: { type: "text", fields: { TEXT: "abc" } } },
            },
          },
          {
            kind: "block",
            type: "text_trim",
            inputs: {
              TEXT: { shadow: { type: "text", fields: { TEXT: " abc " } } },
            },
          },
          {
            kind: "block",
            type: "text_print",
            inputs: {
              TEXT: { shadow: { type: "text", fields: { TEXT: "abc" } } },
            },
          },
        ],
      },
      {
        kind: "category",
        name: m.CAT_LISTS,
        colour: 172,
        cssconfig: { row: "blocklyToolboxCategory blocklyToolboxCategoryLists" },
        contents: [
          { kind: "block", type: "lists_create_with", extraState: { itemCount: 0 } },
          { kind: "block", type: "lists_create_with", extraState: { itemCount: 3 } },
          {
            kind: "block",
            type: "lists_repeat",
            inputs: {
              NUM: { shadow: { type: "math_number", fields: { NUM: 5 } } },
            },
          },
          { kind: "block", type: "lists_length" },
          { kind: "block", type: "lists_isEmpty" },
          { kind: "block", type: "lists_indexOf" },
          { kind: "block", type: "lists_getIndex" },
          { kind: "block", type: "lists_setIndex" },
          { kind: "block", type: "lists_getSublist" },
          {
            kind: "block",
            type: "lists_split",
            inputs: {
              DELIM: { shadow: { type: "text", fields: { TEXT: "," } } },
            },
          },
          { kind: "block", type: "lists_sort" },
          { kind: "block", type: "lists_reverse" },
        ],
      },
      {
        kind: "category",
        name: m.CAT_MAPS,
        colour: 260,
        cssconfig: { row: "blocklyToolboxCategory blocklyToolboxCategoryMaps" },
        contents: [
          { kind: "block", type: "maps_create_with", extraState: { itemCount: 0 } },
          mapsCreateWithToolboxBlock(3),
          { kind: "block", type: "maps_create_empty" },
          {
            kind: "block",
            type: "maps_get",
            fields: { NAME: "defaults" },
            inputs: {
              KEY: { shadow: { type: "text", fields: { TEXT: "language" } } },
            },
          },
          { kind: "block", type: "maps_keys" },
          { kind: "block", type: "maps_length" },
          { kind: "block", type: "maps_isEmpty" },
        ],
      },
      { kind: "sep" },
      {
        kind: "category",
        custom: "VARIABLE",
        name: m.CAT_VARIABLES,
        colour: 4,
        cssconfig: { row: "blocklyToolboxCategory blocklyToolboxCategoryVariables" },
      },
      {
        kind: "category",
        custom: "PROCEDURE",
        name: m.CAT_PROCEDURES,
        colour: 16,
        cssconfig: { row: "blocklyToolboxCategory blocklyToolboxCategoryProcedures" },
      },
    ],
  };
}

/** Flatten `kind: "block"` types so toolbox-search can index custom drawers. */
export function toolboxBlockTypes(toolbox: ToolboxJson): string[] {
  const types: string[] = [];
  const walk = (item: unknown) => {
    if (!item || typeof item !== "object") return;
    const rec = item as { kind?: string; type?: string; contents?: unknown[] };
    if (String(rec.kind ?? "").toLowerCase() === "block" && rec.type) {
      types.push(rec.type);
    }
    if (Array.isArray(rec.contents)) {
      for (const child of rec.contents) walk(child);
    }
  };
  walk(toolbox);
  return types;
}
