/**
 * Blockly mutator with a per-option flyout (no attribute dropdown) and a
 * header cogwheel field to the right of the skeleton title.
 */
import type { BlockSvg } from "blockly/core";
import { Blockly } from "./blockly_core.ts";

const MutatorIcon = Blockly.icons.MutatorIcon;

/** Minimal flyout block JSON for MutatorIcon mini-workspace toolboxes. */
export type MutatorFlyoutBlock = {
  kind: "block";
  type: string;
  extraState?: { attr: string; label: string };
};

/** Blockly mutator cog (16×16) — light fill + dark stroke so it reads on dark RM blocks. */
export const COGWHEEL_SVG = "data:image/svg+xml," + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">` +
    `<path fill="#f8fafc" stroke="#0f172a" stroke-width="0.9" stroke-linejoin="round" d="m4.203,7.296 0,1.368 -0.92,0.677 -0.11,0.41 0.9,1.559 0.41,0.11 1.043,-0.457 1.187,0.683 0.127,1.134 0.3,0.3 1.8,0 0.3,-0.299 0.127,-1.138 1.185,-0.682 1.046,0.458 0.409,-0.11 0.9,-1.559 -0.11,-0.41 -0.92,-0.677 0,-1.366 0.92,-0.677 0.11,-0.41 -0.9,-1.559 -0.409,-0.109 -1.046,0.458 -1.185,-0.682 -0.127,-1.138 -0.3,-0.299 -1.8,0 -0.3,0.3 -0.126,1.135 -1.187,0.682 -1.043,-0.457 -0.41,0.11 -0.899,1.559 0.108,0.409z"/>` +
    `<circle fill="#f8fafc" stroke="#0f172a" stroke-width="0.9" cx="8" cy="8" r="2.55"/>` +
    `<circle fill="#0f172a" cx="8" cy="8" r="1.05"/>` +
    `</svg>`,
);

export function appendMutatorCogwheel(
  header: { appendField: (field: unknown, name?: string) => unknown },
): void {
  header.appendField(
    new Blockly.FieldImage(
      COGWHEEL_SVG,
      16,
      16,
      "Optional attributes…",
      function (this: { getSourceBlock: () => BlockSvg }) {
        const block = this.getSourceBlock();
        if (block) openBlockMutator(block);
      },
    ),
    "MUTATOR_COG",
  );
}

/** Hide Blockly's default top-left mutator icon; the header cogwheel replaces it. */
export function hideDefaultMutatorIcon(block: Blockly.Block): void {
  const svg = block as BlockSvg;
  const apply = () => {
    const MutatorIconType = Blockly.icons?.MutatorIcon?.TYPE;
    if (!MutatorIconType) return;
    const icon = svg.getIcon?.(MutatorIconType);
    if (icon?.svgRoot) icon.svgRoot.style.display = "none";
  };
  if (svg.rendered) {
    apply();
    return;
  }
  const workspace = svg.workspace;
  if (!workspace) return;
  const listener = (event: { blockId?: string }) => {
    if (event.blockId !== svg.id || !svg.rendered) return;
    apply();
    workspace.removeChangeListener(listener);
  };
  workspace.addChangeListener(listener);
}

export function openBlockMutator(block: Blockly.Block): void {
  const MutatorIconType = Blockly.icons?.MutatorIcon?.TYPE;
  const svg = block as BlockSvg;
  const icon = MutatorIconType ? svg.getIcon?.(MutatorIconType) : null;
  if (icon) {
    const isVisible = typeof icon.bubbleIsVisible === "function"
      ? icon.bubbleIsVisible()
      : Boolean((icon as unknown as { miniWorkspaceBubble?: unknown; bubble?: unknown }).miniWorkspaceBubble ?? (icon as unknown as { bubble?: unknown }).bubble);
    void icon.setBubbleVisible(!isVisible);
    return;
  }
  for (const candidate of svg.getIcons?.() ?? []) {
    const isVisible = typeof candidate.bubbleIsVisible === "function"
      ? candidate.bubbleIsVisible()
      : Boolean((candidate as unknown as { miniWorkspaceBubble?: unknown; bubble?: unknown }).miniWorkspaceBubble ?? (candidate as unknown as { bubble?: unknown }).bubble);
    candidate.setBubbleVisible?.(!isVisible);
  }
}

export function getCogwheelAnchorLocation(sourceBlock: BlockSvg): Blockly.utils.Coordinate {
  const blockOrigin = sourceBlock.getRelativeToSurfaceXY();
  const cogField = sourceBlock.getField("MUTATOR_COG") as Blockly.FieldImage | null;
  if (cogField) {
    const svgRoot = cogField.getSvgRoot();
    if (svgRoot && Blockly.utils?.svgMath?.getRelativeXY) {
      try {
        const fieldRel = Blockly.utils.svgMath.getRelativeXY(svgRoot);
        return new Blockly.utils.Coordinate(
          blockOrigin.x + fieldRel.x + 8,
          blockOrigin.y + fieldRel.y + 8,
        );
      } catch {
        // fallback if getRelativeXY throws
      }
    }
    const dimensions = sourceBlock.getHeightWidth?.();
    if (dimensions) {
      return new Blockly.utils.Coordinate(
        blockOrigin.x + dimensions.width - 24,
        blockOrigin.y + 12,
      );
    }
  }
  return blockOrigin;
}

type FlyoutProvider = (
  block: BlockSvg,
  stackNames: string[],
) => MutatorFlyoutBlock[];

function readMutatorStackNames(
  icon: MutatorIcon,
  fallback: string[],
): string[] {
  const root = (icon as unknown as { rootBlock?: Blockly.Block }).rootBlock;
  if (root) return namesFromMutatorStack(root);
  return fallback;
}

export function namesFromMutatorStack(container: Blockly.Block): string[] {
  const names: string[] = [];
  let item: Blockly.Block | null = container.getInputTargetBlock("STACK");
  while (item) {
    if (!item.isInsertionMarker()) {
      const name = String(item.getFieldValue("ATTR") || "");
      if (name && name !== "(none)" && !names.includes(name)) names.push(name);
    }
    item = item.getNextBlock();
  }
  return names;
}

function refreshMutatorFlyout(
  icon: DynamicFlyoutMutatorIcon,
  contentsFor: FlyoutProvider,
): void {
  const mini = icon.getWorkspace?.();
  const flyout = mini?.getFlyout?.();
  if (!flyout) return;
  const block = icon.sourceBlock as BlockSvg;
  const extras = (block as BlockSvg & { extraInputs_?: string[] }).extraInputs_ ??
    (block as BlockSvg & { extraDvFields_?: string[] }).extraDvFields_ ??
    [];
  const stackNames = readMutatorStackNames(icon, extras);
  const contents = contentsFor(block, stackNames);
  // Tighten vertical gaps between flyout option blocks (Blockly default ~24).
  const gapHost = flyout as unknown as { GAP_Y?: number; gap_?: number };
  if (typeof gapHost.GAP_Y === "number") gapHost.GAP_Y = 6;
  if (typeof gapHost.gap_ === "number") gapHost.gap_ = 6;
  flyout.show(contents);
}

export function autoSizeMutatorBubble(
  bubble: {
    getWorkspace?: () => import("blockly/core").WorkspaceSvg;
    miniWorkspace?: import("blockly/core").WorkspaceSvg;
    setSize?: (size: Blockly.utils.Size, relayout?: boolean) => void;
    setBubbleSize?: (width: number, height: number) => void;
    getSize?: () => { width: number; height: number };
  },
  sourceBlock?: BlockSvg,
): void {
  const mini = bubble.getWorkspace?.() ?? bubble.miniWorkspace;
  if (!mini) return;

  const flyout = mini.getFlyout?.();
  let flyoutWidth = 0;
  let flyoutHeight = 0;

  if (flyout) {
    const gapHost = flyout as unknown as { GAP_Y?: number };
    if (typeof gapHost.GAP_Y === "number") gapHost.GAP_Y = 6;
    flyoutWidth = flyout.getWidth?.() ?? 0;
    const flyoutWs = (flyout as unknown as { workspace_?: import("blockly/core").WorkspaceSvg }).workspace_;
    if (flyoutWs) {
      const box = flyoutWs.getBlocksBoundingBox?.();
      if (box && Number.isFinite(box.bottom) && Number.isFinite(box.top)) {
        flyoutHeight = Math.max(flyoutHeight, box.bottom - box.top + 16);
        flyoutWidth = Math.max(flyoutWidth, box.right - box.left + 16);
      }
      const blocks = flyoutWs.getTopBlocks?.(false) ?? [];
      let calculatedFlyoutHeight = 12;
      for (const b of blocks) {
        const hw = b.getHeightWidth?.();
        if (hw) {
          calculatedFlyoutHeight += hw.height + 6;
          flyoutWidth = Math.max(flyoutWidth, hw.width + 20);
        }
      }
      flyoutHeight = Math.max(flyoutHeight, calculatedFlyoutHeight);
    }
  }

  let wsWidth = 120;
  let wsHeight = 72;
  const wsBox = mini.getBlocksBoundingBox?.();
  if (wsBox && Number.isFinite(wsBox.bottom) && Number.isFinite(wsBox.top)) {
    wsWidth = Math.max(wsWidth, wsBox.right - wsBox.left + 24);
    wsHeight = Math.max(wsHeight, wsBox.bottom - wsBox.top + 24);
  }
  const topBlocks = mini.getTopBlocks?.(false) ?? [];
  for (const b of topBlocks) {
    const hw = b.getHeightWidth?.();
    if (hw) {
      wsWidth = Math.max(wsWidth, hw.width + 28);
      wsHeight = Math.max(wsHeight, hw.height + 28);
    }
  }

  const desiredWidth = Math.max(280, flyoutWidth + wsWidth + 36);
  const desiredHeight = Math.max(140, Math.max(flyoutHeight, wsHeight) + 24);

  const parentSvg = sourceBlock?.workspace ? (sourceBlock.workspace as import("blockly/core").WorkspaceSvg).getParentSvg?.() : null;
  const maxAvailableWidth = parentSvg?.clientWidth ? parentSvg.clientWidth - 40 : 1600;
  const maxAvailableHeight = parentSvg?.clientHeight ? parentSvg.clientHeight - 40 : 1000;

  const targetWidth = Math.round(Math.min(desiredWidth, maxAvailableWidth));
  const targetHeight = Math.round(Math.min(desiredHeight, maxAvailableHeight));

  const SizeClass = Blockly.utils?.Size ?? class { constructor(public width: number, public height: number) {} };
  const targetSize = new SizeClass(targetWidth, targetHeight);

  if (typeof bubble.setSize === "function") {
    bubble.setSize(targetSize as unknown as Blockly.utils.Size, true);
  }
  if (typeof bubble.setBubbleSize === "function") {
    bubble.setBubbleSize(targetWidth, targetHeight);
  }
}

export class DynamicFlyoutMutatorIcon extends MutatorIcon {
  private flyoutRefreshListener: ((event: unknown) => void) | null = null;
  private outsideClickListener: ((event: PointerEvent) => void) | null = null;
  private closeButtonSvg: SVGGElement | null = null;
  private closeButtonResizeListener: (() => void) | null = null;

  constructor(
    sourceBlock: BlockSvg,
    private readonly contentsFor: FlyoutProvider,
    private readonly stackFallback: () => string[],
  ) {
    super([], sourceBlock);
    (this as unknown as Record<string, unknown>).getAnchorLocation = () => {
      return getCogwheelAnchorLocation(this.sourceBlock as BlockSvg);
    };
  }

  // @ts-ignore override private method
  override getAnchorLocation(): Blockly.utils.Coordinate {
    return getCogwheelAnchorLocation(this.sourceBlock as BlockSvg);
  }

  override setBubbleVisible(visible: boolean): Promise<void> {
    const block = this.sourceBlock as BlockSvg;
    const self = this as unknown as Record<string, unknown>;
    self.getMiniWorkspaceConfig = () => {
      const stackNames = readMutatorStackNames(this, this.stackFallback());
      const contents = this.contentsFor(block, stackNames);
      return {
        disable: false,
        media: block.workspace.options.pathToMedia,
        rtl: block.RTL,
        renderer: block.workspace.options.renderer,
        rendererOverrides: block.workspace.options.rendererOverrides ?? undefined,
        ...(contents.length
          ? { toolbox: { kind: "flyoutToolbox" as const, contents } }
          : {}),
      };
    };
    return super.setBubbleVisible(visible).then(() => {
      const mini = this.getWorkspace?.();
      const bubble = (this as unknown as {
        miniWorkspaceBubble?: {
          getSvgRoot?: () => SVGGElement;
          svgRoot?: SVGGElement;
          getSize?: () => { width: number; height: number };
          setSize?: (size: Blockly.utils.Size, relayout?: boolean) => void;
          setBubbleSize?: (width: number, height: number) => void;
          getWorkspace?: () => import("blockly/core").WorkspaceSvg;
          miniWorkspace?: import("blockly/core").WorkspaceSvg;
        };
        bubble?: {
          getSvgRoot?: () => SVGGElement;
          svgRoot?: SVGGElement;
          getSize?: () => { width: number; height: number };
          setSize?: (size: Blockly.utils.Size, relayout?: boolean) => void;
          setBubbleSize?: (width: number, height: number) => void;
          getWorkspace?: () => import("blockly/core").WorkspaceSvg;
          miniWorkspace?: import("blockly/core").WorkspaceSvg;
        };
      }).miniWorkspaceBubble ?? (this as unknown as {
        bubble?: {
          getSvgRoot?: () => SVGGElement;
          svgRoot?: SVGGElement;
          getSize?: () => { width: number; height: number };
          setSize?: (size: Blockly.utils.Size, relayout?: boolean) => void;
          setBubbleSize?: (width: number, height: number) => void;
          getWorkspace?: () => import("blockly/core").WorkspaceSvg;
          miniWorkspace?: import("blockly/core").WorkspaceSvg;
        };
      }).bubble;

      if (visible && mini && bubble) {
        this.flyoutRefreshListener = () => {
          refreshMutatorFlyout(this, this.contentsFor);
          autoSizeMutatorBubble(bubble, block);
        };
        mini.addChangeListener(this.flyoutRefreshListener);
        refreshMutatorFlyout(this, this.contentsFor);

        autoSizeMutatorBubble(bubble, block);
        setTimeout(() => autoSizeMutatorBubble(bubble, block), 50);

        this.installCloseButton(bubble);
        this.installOutsideClickListener(bubble);
      } else {
        if (this.flyoutRefreshListener && mini) {
          mini.removeChangeListener(this.flyoutRefreshListener);
          this.flyoutRefreshListener = null;
        }
        this.cleanupCloseButton();
        this.cleanupOutsideClickListener();
      }
    });
  }

  private installCloseButton(bubble: {
    getSvgRoot?: () => SVGGElement;
    svgRoot?: SVGGElement;
    getSize?: () => { width: number; height: number };
    setSize?: (size: Blockly.utils.Size, relayout?: boolean) => void;
    setBubbleSize?: (width: number, height: number) => void;
    getWorkspace?: () => import("blockly/core").WorkspaceSvg;
    miniWorkspace?: import("blockly/core").WorkspaceSvg;
  }): void {
    this.cleanupCloseButton();
    const bubbleSvg = bubble.getSvgRoot?.() ?? bubble.svgRoot;
    if (!bubbleSvg || typeof document === "undefined") return;

    const btn = document.createElementNS("http://www.w3.org/2000/svg", "g");
    btn.setAttribute("class", "intehrgrator-bubble-close-btn");
    btn.style.cursor = "pointer";
    btn.setAttribute("role", "button");
    btn.setAttribute("aria-label", "Close");

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", "0");
    circle.setAttribute("cy", "0");
    circle.setAttribute("r", "10");
    circle.setAttribute("fill", "#ffffff");
    circle.setAttribute("stroke", "#dadce0");
    circle.setAttribute("stroke-width", "1.5");

    const cross = document.createElementNS("http://www.w3.org/2000/svg", "path");
    cross.setAttribute("d", "M -4 -4 L 4 4 M -4 4 L 4 -4");
    cross.setAttribute("stroke", "#5f6368");
    cross.setAttribute("stroke-width", "1.8");
    cross.setAttribute("stroke-linecap", "round");

    btn.appendChild(circle);
    btn.appendChild(cross);

    const updatePosition = () => {
      const size = bubble.getSize?.() ?? { width: 300, height: 200 };
      btn.setAttribute("transform", `translate(${size.width - 16}, 16)`);
    };

    updatePosition();

    btn.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      e.preventDefault();
      void this.setBubbleVisible(false);
    });
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      void this.setBubbleVisible(false);
    });

    bubbleSvg.appendChild(btn);
    this.closeButtonSvg = btn;

    const mini = this.getWorkspace?.();
    if (mini) {
      this.closeButtonResizeListener = () => {
        autoSizeMutatorBubble(bubble, this.sourceBlock as BlockSvg);
        updatePosition();
      };
      mini.addChangeListener(this.closeButtonResizeListener);
    }
  }

  private cleanupCloseButton(): void {
    if (this.closeButtonSvg) {
      this.closeButtonSvg.remove();
      this.closeButtonSvg = null;
    }
    if (this.closeButtonResizeListener) {
      const mini = this.getWorkspace?.();
      if (mini) {
        mini.removeChangeListener(this.closeButtonResizeListener);
      }
      this.closeButtonResizeListener = null;
    }
  }

  private installOutsideClickListener(bubble: {
    getSvgRoot?: () => SVGGElement;
    svgRoot?: SVGGElement;
  }): void {
    this.cleanupOutsideClickListener();
    if (typeof document === "undefined") return;

    const block = this.sourceBlock as BlockSvg;
    this.outsideClickListener = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      const bubbleSvg = bubble.getSvgRoot?.() ?? bubble.svgRoot;
      if (bubbleSvg && bubbleSvg.contains(target)) return;

      const cogField = block.getField("MUTATOR_COG") as Blockly.FieldImage | null;
      const cogSvg = cogField?.getSvgRoot?.();
      if (cogSvg && cogSvg.contains(target)) return;

      if (target instanceof Element && target.closest(".blocklyDropDownDiv, .blocklyWidgetDiv, .blocklyFlyout")) {
        return;
      }

      void this.setBubbleVisible(false);
    };

    setTimeout(() => {
      if (this.outsideClickListener && this.bubbleIsVisible()) {
        document.addEventListener("pointerdown", this.outsideClickListener, true);
      }
    }, 0);
  }

  private cleanupOutsideClickListener(): void {
    if (this.outsideClickListener && typeof document !== "undefined") {
      document.removeEventListener("pointerdown", this.outsideClickListener, true);
      this.outsideClickListener = null;
    }
  }

  override dispose(): void {
    this.cleanupCloseButton();
    this.cleanupOutsideClickListener();
    super.dispose();
  }
}

export function registerDynamicFlyoutMutator(
  name: string,
  mixin: Blockly.Mutator & Record<string, unknown>,
  helper: (this: Blockly.Block) => void,
  contentsFor: FlyoutProvider,
  stackFallback: (block: BlockSvg) => string[],
): void {
  Blockly.Extensions.register(name, function (this: Blockly.Block) {
    this.mixin(mixin);
    helper.apply(this);
    const blockSvg = this as BlockSvg;
    this.setMutator(
      new DynamicFlyoutMutatorIcon(
        blockSvg,
        contentsFor,
        () => stackFallback(blockSvg),
      ),
    );
    hideDefaultMutatorIcon(this);
  });
}
