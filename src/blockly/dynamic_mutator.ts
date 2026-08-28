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

/** Blockly mutator cog (16×16), same motif as MutatorIcon. */
export const COGWHEEL_SVG = "data:image/svg+xml," + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">` +
    `<path fill="#5f6368" d="m4.203,7.296 0,1.368 -0.92,0.677 -0.11,0.41 0.9,1.559 0.41,0.11 1.043,-0.457 1.187,0.683 0.127,1.134 0.3,0.3 1.8,0 0.3,-0.299 0.127,-1.138 1.185,-0.682 1.046,0.458 0.409,-0.11 0.9,-1.559 -0.11,-0.41 -0.92,-0.677 0,-1.366 0.92,-0.677 0.11,-0.41 -0.9,-1.559 -0.409,-0.109 -1.046,0.458 -1.185,-0.682 -0.127,-1.138 -0.3,-0.299 -1.8,0 -0.3,0.3 -0.126,1.135 -1.187,0.682 -1.043,-0.457 -0.41,0.11 -0.899,1.559 0.108,0.409z"/>` +
    `<circle fill="#5f6368" cx="8" cy="8" r="2.7"/>` +
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
  if (icon?.setBubbleVisible) {
    void icon.setBubbleVisible(true);
    return;
  }
  for (const candidate of svg.getIcons?.() ?? []) {
    candidate.setBubbleVisible?.(true);
  }
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
  flyout.show(contents);
}

export class DynamicFlyoutMutatorIcon extends MutatorIcon {
  private flyoutRefreshListener: ((event: unknown) => void) | null = null;

  constructor(
    sourceBlock: BlockSvg,
    private readonly contentsFor: FlyoutProvider,
    private readonly stackFallback: () => string[],
  ) {
    super([], sourceBlock);
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
      if (visible && mini) {
        this.flyoutRefreshListener = () => {
          refreshMutatorFlyout(this, this.contentsFor);
        };
        mini.addChangeListener(this.flyoutRefreshListener);
        refreshMutatorFlyout(this, this.contentsFor);
      } else if (this.flyoutRefreshListener && mini) {
        mini.removeChangeListener(this.flyoutRefreshListener);
        this.flyoutRefreshListener = null;
      }
    });
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
