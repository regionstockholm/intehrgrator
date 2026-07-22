/**
 * @license
 * Copyright 2022 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * Adapted from Blockly DevSite landing demo toolbox:
 * https://github.com/RaspberryPiFoundation/blockly-samples/blob/main/examples/devsite-landing-demo/toolbox.js
 *
 * intEHRgrator additions: Source + Data values categories, for_each_source in Loops.
 */

import type { BlocklyOptions } from "blockly/core";
import { dataValueLeafTypes, blockTypeForRm } from "../core/rm_meta.ts";
import { msg } from "./i18n/custom_msg.ts";

export type ToolboxJson = NonNullable<BlocklyOptions["toolbox"]>;

function dataValueToolboxContents(): Array<{ kind: string; type: string }> {
  return dataValueLeafTypes().map((rmType) => ({
    kind: "block",
    type: blockTypeForRm(rmType),
  }));
}

/** Build the workspace toolbox (Blockly demo + Source / Data values). */
export function buildDemoToolbox(locale: string): ToolboxJson {
  const m = msg(locale);
  return {
    kind: "categoryToolbox",
    contents: [
      {
        kind: "category",
        name: m.CAT_SOURCE,
        colour: 28,
        cssconfig: { row: "blocklyToolboxCategory blocklyToolboxCategorySource" },
        contents: [
          { kind: "block", type: "source_query" },
        ],
      },
      {
        kind: "category",
        name: m.CAT_DATA_VALUES,
        colour: 230,
        cssconfig: { row: "blocklyToolboxCategory blocklyToolboxCategoryDataValues" },
        contents: dataValueToolboxContents(),
      },
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
