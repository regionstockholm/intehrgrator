/**
 * Registers `@blockly/toolbox-search` (Blockly 11 plugin) so toolbox JSON
 * may include `{ kind: "search" }`. Custom drawers are indexed because they
 * are ordinary `kind: "block"` entries.
 *
 * The plugin puts a search `<input>` inside the category row, then the
 * category's click handler `preventDefault`s — so we stop pointer events
 * on the input from bubbling to the row.
 */
import "@blockly/toolbox-search";

export function installToolboxSearchInputFix(mount: HTMLElement): void {
  const stopIfSearch = (event: Event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.type === "search") {
      event.stopPropagation();
    }
  };
  for (const type of ["pointerdown", "mousedown", "click"] as const) {
    mount.addEventListener(type, stopIfSearch, true);
  }
}
