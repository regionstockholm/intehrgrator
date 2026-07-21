import { Blockly } from "./blockly_core.ts";

/** Karolinska-aligned dense zelos theme for long OPT trees. */
export function createCompactTheme(): Blockly.Theme {
  const Theme = Blockly.Theme;
  const base = Blockly.Themes?.Zelos ?? Blockly.Themes?.Classic;
  return Theme.defineTheme("intehrgrator_compact", {
    name: "intehrgrator_compact",
    base,
    fontStyle: {
      family: '"Segoe UI", "Helvetica Neue", sans-serif',
      weight: "500",
      size: 11,
    },
    componentStyles: {
      workspaceBackgroundColour: "#F7F5F2",
      toolboxBackgroundColour: "#EFEBE6",
      toolboxForegroundColour: "#003B49",
      flyoutBackgroundColour: "#F7F5F2",
      flyoutForegroundColour: "#003B49",
      flyoutOpacity: 0.95,
      scrollbarColour: "#C4BDB4",
      insertionMarkerColour: "#E87722",
      insertionMarkerOpacity: 0.4,
      scrollbarOpacity: 0.5,
      cursorColour: "#E87722",
    },
    blockStyles: {
      colour_blocks: {
        colourPrimary: "#4A6FA5",
        colourSecondary: "#6B8BB8",
        colourTertiary: "#3A5A85",
      },
      list_blocks: {
        colourPrimary: "#005C53",
        colourSecondary: "#2A7A70",
        colourTertiary: "#004840",
      },
      logic_blocks: {
        colourPrimary: "#A6745B",
        colourSecondary: "#C09078",
        colourTertiary: "#8A5A42",
      },
      loop_blocks: {
        colourPrimary: "#A6745B",
        colourSecondary: "#C09078",
        colourTertiary: "#8A5A42",
      },
      math_blocks: {
        colourPrimary: "#A6745B",
        colourSecondary: "#C09078",
        colourTertiary: "#8A5A42",
      },
      procedure_blocks: {
        colourPrimary: "#A65B80",
        colourSecondary: "#C0789A",
        colourTertiary: "#8A4568",
      },
      text_blocks: {
        colourPrimary: "#5BA68D",
        colourSecondary: "#7CBCA5",
        colourTertiary: "#458870",
      },
      variable_blocks: {
        colourPrimary: "#A65B80",
        colourSecondary: "#C0789A",
        colourTertiary: "#8A4568",
      },
      variable_dynamic_blocks: {
        colourPrimary: "#A65B80",
        colourSecondary: "#C0789A",
        colourTertiary: "#8A4568",
      },
    },
    categoryStyles: {
      colour_category: { colour: "#4A6FA5" },
      list_category: { colour: "#005C53" },
      logic_category: { colour: "#A6745B" },
      loop_category: { colour: "#A6745B" },
      math_category: { colour: "#A6745B" },
      procedure_category: { colour: "#A65B80" },
      text_category: { colour: "#5BA68D" },
      variable_category: { colour: "#A65B80" },
      variable_dynamic_category: { colour: "#A65B80" },
    },
  });
}
