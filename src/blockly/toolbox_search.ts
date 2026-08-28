/**
 * Registers `@blockly/toolbox-search` (Blockly 11 plugin) so toolbox JSON
 * may include `{ kind: "search" }`. Custom drawers are indexed because they
 * are ordinary `kind: "block"` entries.
 *
 * The plugin renders the search `<input>` inside the category row. That row
 * would otherwise intercept pointer events, so CSS lets the input receive
 * clicks and this helper selects the Search category when the field is focused.
 */
import "@blockly/toolbox-search";
import type { WorkspaceSvg } from "blockly/core";

export function installToolboxSearchInputFix(
  mount: HTMLElement,
  getWorkspace: () => WorkspaceSvg,
): void {
  mount.addEventListener("focusin", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.type !== "search") return;
    const toolbox = getWorkspace().getToolbox?.();
    if (!toolbox || typeof toolbox.getToolboxItems !== "function") return;
    const items = toolbox.getToolboxItems();
    const search = items.find((item) => {
      const div = typeof item.getDiv === "function" ? item.getDiv() : null;
      return div instanceof HTMLElement && div.contains(target);
    });
    if (search && typeof toolbox.setSelectedItem === "function") {
      toolbox.setSelectedItem(search);
    }
  });
}
