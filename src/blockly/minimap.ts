import type { WorkspaceSvg } from "blockly/core";
import { PositionedMinimap } from "@blockly/workspace-minimap";

/**
 * Official Blockly minimap. Hidden until workspace content overflows the
 * visible canvas at the current zoom (see UI_ARCHITECTURE.md).
 */
export function attachWorkspaceMinimap(
  workspace: WorkspaceSvg,
  mount: HTMLElement,
): void {
  const minimap = new PositionedMinimap(workspace);
  minimap.init();

  const updateVisibility = () => {
    const metrics = workspace.getMetrics?.();
    if (!metrics) {
      mount.classList.add("blockly-minimap-hidden");
      return;
    }
    const overflow =
      Number(metrics.scrollWidth ?? metrics.contentWidth ?? 0) >
        Number(metrics.viewWidth ?? 0) ||
      Number(metrics.scrollHeight ?? metrics.contentHeight ?? 0) >
        Number(metrics.viewHeight ?? 0);
    mount.classList.toggle("blockly-minimap-hidden", !overflow);
  };

  workspace.addChangeListener(updateVisibility);
  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(updateVisibility);
    observer.observe(mount);
  }
  updateVisibility();
}
