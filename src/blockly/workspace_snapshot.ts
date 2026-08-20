/**
 * Standalone SVG snapshot of a Blockly workspace for print / save.
 *
 * Adapted from Blockly's playground screenshot helper
 * (Apache-2.0, Google LLC):
 * https://github.com/google/blockly/blob/master/tests/playgrounds/screenshot.js
 */

const SVG_NS = "http://www.w3.org/2000/svg";
const SNAPSHOT_WINDOW_NAME = "intehrgrator-blockly-canvas";
const VIEW_PADDING = 16;

export interface BlocksBoundingBox {
  x?: number;
  y?: number;
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
  width?: number;
  height?: number;
  getWidth?: () => number;
  getHeight?: () => number;
}

/** Minimal WorkspaceSvg surface used for snapshots (avoids pulling Blockly into unit tests). */
export interface WorkspaceSvgLike {
  getCanvas(): SVGGElement;
  getParentSvg(): SVGElement;
  getBlocksBoundingBox(): BlocksBoundingBox;
  getTheme?: () => { name?: string } | null;
  options?: { renderer?: string };
  getBubbleCanvas?: () => SVGGElement | null;
}

export interface StandaloneSvg {
  svgXml: string;
  width: number;
  height: number;
  empty: boolean;
}

export interface CanvasSnapshotHtmlOptions {
  title: string;
  svgXml: string;
  filenameBase: string;
  empty?: boolean;
}

export interface OpenWorkspaceSnapshotOptions {
  title?: string;
  filenameBase?: string;
  /** Called when `window.open` is blocked; receive the SVG XML for a download fallback. */
  onBlocked?: (svgXml: string, filenameBase: string) => void;
}

export function rectFromBlocksBoundingBox(
  bBox: BlocksBoundingBox,
): { x: number; y: number; width: number; height: number } {
  const x = numberOr(bBox.x, bBox.left, 0);
  const y = numberOr(bBox.y, bBox.top, 0);
  const width = positiveNumber(
    bBox.width,
    typeof bBox.getWidth === "function" ? bBox.getWidth() : undefined,
    bBox.right != null ? bBox.right - x : undefined,
  );
  const height = positiveNumber(
    bBox.height,
    typeof bBox.getHeight === "function" ? bBox.getHeight() : undefined,
    bBox.bottom != null ? bBox.bottom - y : undefined,
  );
  return { x, y, width, height };
}

/** Keep rules that style Blockly graphics; drop the `.blockly-mount` layout shell. */
export function isBlocklyGraphicCss(cssText: string, styleId = ""): boolean {
  if (styleId.startsWith("blockly-")) return true;
  return /\.blockly(?!-mount\b)/i.test(cssText);
}

export function rewriteBlocklyMountSelectors(css: string): string {
  return css.replaceAll(".blockly-mount ", "").replaceAll(".blockly-mount", "");
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function snapshotFilenameBase(value: string | undefined | null): string {
  const trimmed = (value ?? "").trim();
  const safe = (trimmed || "mapping-canvas").replace(/[^A-Za-z0-9._-]+/g, "-");
  return safe.replace(/^-+|-+$/g, "") || "mapping-canvas";
}

export function collectBlocklyCss(doc: Document): string {
  const chunks: string[] = [];
  const seen = new Set<string>();
  const add = (text: string) => {
    const rewritten = rewriteBlocklyMountSelectors(text).trim();
    if (!rewritten || seen.has(rewritten)) return;
    seen.add(rewritten);
    chunks.push(rewritten);
  };

  for (const el of Array.from(doc.querySelectorAll("style"))) {
    const text = el.textContent ?? "";
    if (isBlocklyGraphicCss(text, el.id)) add(text);
  }

  for (const sheet of Array.from(doc.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(rules)) {
      if (isBlocklyGraphicCss(rule.cssText)) add(rule.cssText);
    }
  }

  return chunks.join("\n");
}

export function workspaceToStandaloneSvg(
  workspace: WorkspaceSvgLike,
  doc: Document = document,
): StandaloneSvg {
  flushBlocklyTextAreas(workspace, doc);

  const { x, y, width, height } = rectFromBlocksBoundingBox(
    workspace.getBlocksBoundingBox(),
  );
  if (width <= 0 || height <= 0) {
    return { svgXml: "", width: 0, height: 0, empty: true };
  }

  const paddedX = x - VIEW_PADDING;
  const paddedY = y - VIEW_PADDING;
  const paddedWidth = width + VIEW_PADDING * 2;
  const paddedHeight = height + VIEW_PADDING * 2;

  const svg = doc.createElementNS(SVG_NS, "svg");
  svg.setAttribute("xmlns", SVG_NS);
  svg.setAttribute("viewBox", `${paddedX} ${paddedY} ${paddedWidth} ${paddedHeight}`);
  svg.setAttribute("width", String(paddedWidth));
  svg.setAttribute("height", String(paddedHeight));
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Blockly mapping canvas");
  const renderer = workspace.options?.renderer || "geras";
  const theme = workspace.getTheme?.()?.name || "classic";
  svg.setAttribute("class", `blocklySvg ${renderer}-renderer ${theme}-theme`);
  svg.style.backgroundColor = "#ffffff";

  const parentSvg = workspace.getParentSvg();
  const defs = parentSvg.querySelector("defs");
  if (defs) svg.appendChild(defs.cloneNode(true));

  const canvas = workspace.getCanvas().cloneNode(true) as SVGGElement;
  canvas.removeAttribute("transform");
  svg.appendChild(canvas);

  const bubbles = workspace.getBubbleCanvas?.();
  if (bubbles && bubbles.childNodes.length > 0) {
    const bubbleClone = bubbles.cloneNode(true) as SVGGElement;
    bubbleClone.removeAttribute("transform");
    svg.appendChild(bubbleClone);
  }

  const css = collectBlocklyCss(doc);
  if (css) {
    const style = doc.createElementNS(SVG_NS, "style");
    style.textContent = css;
    svg.insertBefore(style, svg.firstChild);
  }

  let svgXml = new XMLSerializer().serializeToString(svg);
  svgXml = svgXml.replace(/&nbsp/g, "&#160");
  return { svgXml, width: paddedWidth, height: paddedHeight, empty: false };
}

export function buildCanvasSnapshotHtml(options: CanvasSnapshotHtmlOptions): string {
  const title = options.title.trim() || "intEHRgrator — Mapping canvas";
  const filenameBase = snapshotFilenameBase(options.filenameBase);
  const empty = options.empty || !options.svgXml.trim();
  const canvasBody = empty
    ? `<p class="empty">No blocks on the canvas yet. Load a target template, then try again.</p>`
    : options.svgXml;
  const saveDisabled = empty ? " disabled" : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Google+Sans:400,500" />
  <style>
    :root { --primary: #005c53; --primary-dark: #003b49; }
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; background: #f5f5f0; color: #1a1a1a;
      font-family: "Google Sans", "Segoe UI", system-ui, sans-serif; }
    .toolbar {
      position: sticky; top: 0; z-index: 2;
      display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
      padding: 8px 12px; background: var(--primary-dark); color: #fff;
    }
    .toolbar strong { font-weight: 500; }
    .toolbar-spacer { flex: 1; }
    .toolbar button {
      background: var(--primary); color: #fff; border: 1px solid transparent;
      border-radius: 4px; padding: 6px 10px; cursor: pointer; font-size: 13px;
    }
    .toolbar button:hover:not(:disabled) { background: #00786b; }
    .toolbar button:disabled { opacity: 0.45; cursor: not-allowed; }
    .canvas-wrap { padding: 16px; overflow: auto; }
    .canvas-wrap svg {
      display: block; max-width: none; background: #fff;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
    }
    .empty { padding: 48px 16px; text-align: center; color: #666; }
    @media print {
      .toolbar { display: none !important; }
      html, body { background: #fff; }
      .canvas-wrap { padding: 0; overflow: visible; }
      .canvas-wrap svg { box-shadow: none; max-width: 100%; height: auto; }
    }
  </style>
</head>
<body>
  <header class="toolbar">
    <strong>${escapeHtml(title)}</strong>
    <span class="toolbar-spacer"></span>
    <button type="button" id="btn-print">Print</button>
    <button type="button" id="btn-save-svg"${saveDisabled}>Save SVG</button>
    <button type="button" id="btn-save-png"${saveDisabled}>Save PNG</button>
  </header>
  <div class="canvas-wrap" id="canvas">${canvasBody}</div>
  <script>
    const FILE_BASE = ${JSON.stringify(filenameBase)};
    document.getElementById("btn-print")?.addEventListener("click", () => window.print());
    document.getElementById("btn-save-svg")?.addEventListener("click", () => {
      const svg = document.querySelector("#canvas svg");
      if (!svg) return;
      downloadBlob(FILE_BASE + ".svg", new Blob(
        [new XMLSerializer().serializeToString(svg)],
        { type: "image/svg+xml;charset=utf-8" },
      ));
    });
    document.getElementById("btn-save-png")?.addEventListener("click", () => {
      const svg = document.querySelector("#canvas svg");
      if (!svg) return;
      svgToPngBlob(svg).then((blob) => {
        if (blob) downloadBlob(FILE_BASE + ".png", blob);
      }).catch((err) => console.warn("PNG export failed", err));
    });
    function downloadBlob(filename, blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    function svgToPngBlob(svg) {
      const xml = new XMLSerializer().serializeToString(svg);
      const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          try {
            const w = Number(svg.getAttribute("width")) || img.naturalWidth || 1;
            const h = Number(svg.getAttribute("height")) || img.naturalHeight || 1;
            const scale = Math.min(2, 8192 / Math.max(w, h, 1));
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(w * scale));
            canvas.height = Math.max(1, Math.round(h * scale));
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => resolve(blob), "image/png");
          } catch (err) {
            reject(err);
          } finally {
            URL.revokeObjectURL(url);
          }
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("Could not rasterize SVG"));
        };
        img.src = url;
      });
    }
  </script>
</body>
</html>`;
}

export function openWorkspaceSnapshotWindow(
  workspace: WorkspaceSvgLike,
  options: OpenWorkspaceSnapshotOptions = {},
  doc: Document = document,
): Window | null {
  const snapshot = workspaceToStandaloneSvg(workspace, doc);
  const title = options.title?.trim() || "intEHRgrator — Mapping canvas";
  const filenameBase = snapshotFilenameBase(options.filenameBase);
  const html = buildCanvasSnapshotHtml({
    title,
    svgXml: snapshot.svgXml,
    filenameBase,
    empty: snapshot.empty,
  });

  const opener = globalThis.open?.bind(globalThis);
  if (typeof opener !== "function") {
    options.onBlocked?.(snapshot.svgXml, filenameBase);
    return null;
  }

  const popup = opener("", SNAPSHOT_WINDOW_NAME);
  if (!popup) {
    options.onBlocked?.(snapshot.svgXml, filenameBase);
    return null;
  }

  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  return popup;
}

function flushBlocklyTextAreas(workspace: WorkspaceSvgLike, doc: Document): void {
  const roots: ParentNode[] = [];
  try {
    roots.push(workspace.getParentSvg());
  } catch {
    // Headless / missing SVG.
  }
  for (const el of Array.from(doc.querySelectorAll(".blocklyWidgetDiv, .blocklyDropDownDiv"))) {
    roots.push(el);
  }
  for (const root of roots) {
    for (const ta of Array.from(root.querySelectorAll("textarea"))) {
      ta.textContent = (ta as HTMLTextAreaElement).value;
    }
  }
}

function numberOr(...values: Array<number | undefined>): number {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return 0;
}

function positiveNumber(...values: Array<number | undefined>): number {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}
