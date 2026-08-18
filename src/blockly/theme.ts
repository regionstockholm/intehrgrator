/**
 * @license
 * Copyright 2022 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * "modest" theme adapted from Blockly DevSite landing demo:
 * https://github.com/RaspberryPiFoundation/blockly-samples/blob/main/examples/devsite-landing-demo/script.js
 */
import { Blockly } from "./blockly_core.ts";

export function createModestTheme(): Blockly.Theme {
  const Theme = Blockly.Theme;
  return Theme.defineTheme("modest", {
    name: "modest",
    fontStyle: {
      family: '"Google Sans", "Segoe UI", "Segoe UI Emoji", "Apple Color Emoji", sans-serif',
      weight: "normal",
      size: 12,
    },
    blockStyles: {
      logic_blocks: {
        colourPrimary: "#D1C4E9",
        colourSecondary: "#EDE7F6",
        colourTertiary: "#B39DDB",
      },
      loop_blocks: {
        colourPrimary: "#A5D6A7",
        colourSecondary: "#E8F5E9",
        colourTertiary: "#66BB6A",
      },
      math_blocks: {
        colourPrimary: "#2196F3",
        colourSecondary: "#1E88E5",
        colourTertiary: "#0D47A1",
      },
      text_blocks: {
        colourPrimary: "#FFCA28",
        colourSecondary: "#FFF8E1",
        colourTertiary: "#FF8F00",
      },
      list_blocks: {
        colourPrimary: "#4DB6AC",
        colourSecondary: "#B2DFDB",
        colourTertiary: "#009688",
      },
      variable_blocks: {
        colourPrimary: "#EF9A9A",
        colourSecondary: "#FFEBEE",
        colourTertiary: "#EF5350",
      },
      variable_dynamic_blocks: {
        colourPrimary: "#EF9A9A",
        colourSecondary: "#FFEBEE",
        colourTertiary: "#EF5350",
      },
      procedure_blocks: {
        colourPrimary: "#D7CCC8",
        colourSecondary: "#EFEBE9",
        colourTertiary: "#BCAAA4",
      },
      // intEHRgrator Source accent (source_query uses colour_blocks style)
      colour_blocks: {
        colourPrimary: "#E87722",
        colourSecondary: "#FFCC80",
        colourTertiary: "#EF6C00",
      },
    },
    categoryStyles: {
      logic_category: { colour: "#D1C4E9" },
      loop_category: { colour: "#A5D6A7" },
      math_category: { colour: "#2196F3" },
      text_category: { colour: "#FFCA28" },
      list_category: { colour: "#4DB6AC" },
      variable_category: { colour: "#EF9A9A" },
      variable_dynamic_category: { colour: "#EF9A9A" },
      procedure_category: { colour: "#D7CCC8" },
    },
    componentStyles: {
      workspaceBackgroundColour: "#ffffff",
      toolboxBackgroundColour: "#ffffff",
      toolboxForegroundColour: "#202124",
      flyoutBackgroundColour: "#ffffff",
      flyoutForegroundColour: "#202124",
      flyoutOpacity: 1,
      scrollbarColour: "#dadce0",
      insertionMarkerColour: "#1a73e8",
      insertionMarkerOpacity: 0.4,
      scrollbarOpacity: 0.5,
      cursorColour: "#1a73e8",
    },
  });
}
