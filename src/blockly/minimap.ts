import type { WorkspaceSvg } from "blockly/core";
import * as MinimapNs from "@blockly/workspace-minimap";
import { Blockly } from "./blockly_core.ts";
import {
  copyWorkspaceState,
  setAfterBlocklyEventsEnabled,
} from "./blockly_events.ts";

// Deno/CJS interop: the plugin is a CJS bundle; esbuild sees named exports.
// deno-lint-ignore no-explicit-any
const minimapMod = MinimapNs as any;
const Minimap: typeof MinimapNs.Minimap =
  minimapMod.Minimap ?? minimapMod.default?.Minimap;

/**
 * Official Blockly minimap, reparented into the toolbox rail as its last
 * child so it cannot sit under `.blocklyToolboxDiv` (z-index 70) or cover
 * the canvas. Always shown: once docked in the toolbox it does not steal
 * workspace area.
 *
 * The plugin only mirrors BLOCK_* events. Template scaffolding and the
 * Defaults Map are created with events disabled, so we snapshot-copy the
 * primary workspace after those bulk loads.
 */
class DockedMinimap extends Minimap {
  syncFromPrimary(): void {
    const mini = this.minimapWorkspace;
    if (!mini) return;
    copyWorkspaceState(this.primaryWorkspace, mini);
    mini.zoomToFit();
  }

  layoutInToolbox(mount: HTMLElement): void {
    const toolboxEl = mount.querySelector(".blocklyToolboxDiv") as HTMLElement | null;
    const wrapper = this.minimapWrapper;
    if (toolboxEl && wrapper && wrapper.parentElement !== toolboxEl) {
      toolboxEl.appendChild(wrapper);
    }

    // Search sits with the minimap (fixed foot), not in the scrolling category list.
    const searchRow = toolboxEl?.querySelector(
      ".blocklyToolboxCategorySearch, .blocklyToolboxCategory:has(input[type='search'])",
    ) as HTMLElement | null;
    if (toolboxEl && searchRow && searchRow.parentElement !== toolboxEl) {
      if (wrapper && wrapper.parentElement === toolboxEl) {
        toolboxEl.insertBefore(searchRow, wrapper);
      } else {
        toolboxEl.appendChild(searchRow);
      }
    } else if (toolboxEl && searchRow && wrapper && wrapper.parentElement === toolboxEl) {
      // Keep search immediately above the minimap.
      if (searchRow.nextElementSibling !== wrapper) {
        toolboxEl.insertBefore(searchRow, wrapper);
      }
    }

    const toolbox = this.primaryWorkspace.getToolbox?.();
    const width = Math.round(
      (typeof toolbox?.getWidth === "function" ? toolbox.getWidth() : 0) ||
        toolboxEl?.offsetWidth ||
        0,
    );
    if (width > 0) {
      const mountHeight = mount.clientHeight || 0;
      const height = Math.round(
        Math.min(180, Math.max(width, mountHeight > 0 ? mountHeight * 0.28 : width)),
      );
      mount.style.setProperty("--blockly-minimap-width", `${width}px`);
      mount.style.setProperty("--blockly-minimap-height", `${height}px`);
    }
    if (this.minimapWorkspace) {
      Blockly.svgResize(this.minimapWorkspace);
      this.minimapWorkspace.zoomToFit();
    }
  }
}

type AttachedMinimap = {
  minimap: DockedMinimap;
  workspace: WorkspaceSvg;
  mount: HTMLElement;
};

let attached: AttachedMinimap | null = null;

export function attachWorkspaceMinimap(
  workspace: WorkspaceSvg,
  mount: HTMLElement,
): void {
  const minimap = new DockedMinimap(workspace);
  minimap.init();
  attached = { minimap, workspace, mount };
  setAfterBlocklyEventsEnabled(refreshWorkspaceMinimap);
  mount.classList.remove("blockly-minimap-hidden");

  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(() => {
      minimap.layoutInToolbox(mount);
    });
    observer.observe(mount);
  }
  minimap.syncFromPrimary();
  minimap.layoutInToolbox(mount);
}

/** Re-copy primary blocks into the minimap and re-dock under the toolbox. */
export function refreshWorkspaceMinimap(): void {
  if (!attached) return;
  attached.minimap.syncFromPrimary();
  attached.minimap.layoutInToolbox(attached.mount);
}
