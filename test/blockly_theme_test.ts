import { assert } from "@std/assert";
import { createModestTheme } from "@intehrgrator/blockly/theme.ts";

Deno.test("modest theme tints toolbox and flyout off the white canvas", () => {
  const theme = createModestTheme();
  const toolbox = String(theme.componentStyles?.toolboxBackgroundColour ?? "");
  const flyout = String(theme.componentStyles?.flyoutBackgroundColour ?? "");
  assertEqualsIgnoreCase(toolbox, "#e8f5f2");
  assertEqualsIgnoreCase(flyout, "#e8f5f2");
  assert(toolbox.toLowerCase() !== "#ffffff");
  assert(String(theme.componentStyles?.workspaceBackgroundColour ?? "").toLowerCase() === "#ffffff");
});

function assertEqualsIgnoreCase(actual: string, expected: string): void {
  assert(
    actual.toLowerCase() === expected.toLowerCase(),
    `expected ${expected}, got ${actual}`,
  );
}
