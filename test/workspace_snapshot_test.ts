import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import {
  buildCanvasSnapshotHtml,
  escapeHtml,
  isBlocklyGraphicCss,
  rectFromBlocksBoundingBox,
  rewriteBlocklyMountSelectors,
  snapshotFilenameBase,
} from "@intehrgrator/blockly/workspace_snapshot.ts";

Deno.test("rectFromBlocksBoundingBox reads Blockly Rect left/top/right/bottom", () => {
  const rect = rectFromBlocksBoundingBox({ left: 10, top: 20, right: 110, bottom: 80 });
  assertEquals(rect, { x: 10, y: 20, width: 100, height: 60 });
});

Deno.test("rectFromBlocksBoundingBox reads x/y/width/height", () => {
  const rect = rectFromBlocksBoundingBox({ x: 4, y: 8, width: 40, height: 16 });
  assertEquals(rect, { x: 4, y: 8, width: 40, height: 16 });
});

Deno.test("rectFromBlocksBoundingBox prefers getWidth/getHeight over a zero width field", () => {
  const rect = rectFromBlocksBoundingBox({
    left: 0,
    top: 0,
    right: 50,
    bottom: 25,
    width: 0,
    getWidth: () => 50,
    getHeight: () => 25,
  });
  assertEquals(rect, { x: 0, y: 0, width: 50, height: 25 });
});

Deno.test("rewriteBlocklyMountSelectors drops the mount prefix so snapshot CSS still matches", () => {
  const css = rewriteBlocklyMountSelectors(
    ".blockly-mount .blocklyText { font-size: 12px; } .blocklySvg { background: #fff; }",
  );
  assertStringIncludes(css, ".blocklyText { font-size: 12px; }");
  assertStringIncludes(css, ".blocklySvg { background: #fff; }");
  assertEquals(css.includes(".blockly-mount"), false);
});

Deno.test("isBlocklyGraphicCss keeps block styles and drops the mount shell", () => {
  assertEquals(isBlocklyGraphicCss(".blocklyText { font-size: 12px; }"), true);
  assertEquals(isBlocklyGraphicCss(".blockly-mount { min-height: 120px; }"), false);
  assertEquals(isBlocklyGraphicCss(".blockly-mount .blocklyPath { stroke: #fff; }"), true);
  assertEquals(isBlocklyGraphicCss("body { margin: 0; }", "blockly-renderer-style-thrasos"), true);
});

Deno.test("snapshotFilenameBase sanitizes template ids", () => {
  assertEquals(snapshotFilenameBase("Blood Pressure"), "Blood-Pressure");
  assertEquals(snapshotFilenameBase("  "), "mapping-canvas");
  assertEquals(snapshotFilenameBase(null), "mapping-canvas");
});

Deno.test("buildCanvasSnapshotHtml embeds SVG and print/save actions", () => {
  const html = buildCanvasSnapshotHtml({
    title: "intEHRgrator — <Blood>",
    filenameBase: "bp template",
    svgXml: `<svg class="blocklySvg" xmlns="http://www.w3.org/2000/svg"><g class="blocklyBlockCanvas"/></svg>`,
  });
  assertStringIncludes(html, "intEHRgrator — &lt;Blood&gt;");
  assertStringIncludes(html, 'id="btn-print"');
  assertStringIncludes(html, 'id="btn-save-svg"');
  assertStringIncludes(html, 'id="btn-save-png"');
  assertStringIncludes(html, "class=\"blocklySvg\"");
  assertStringIncludes(html, '@media print');
  assertStringIncludes(html, JSON.stringify("bp-template"));
  assertEquals(html.includes("<Blood>"), false);
});

Deno.test("buildCanvasSnapshotHtml empty canvas disables saves and explains the gap", () => {
  const html = buildCanvasSnapshotHtml({
    title: "intEHRgrator — Mapping canvas",
    filenameBase: "mapping-canvas",
    svgXml: "",
    empty: true,
  });
  assertStringIncludes(html, "No blocks on the canvas yet");
  assertStringIncludes(html, 'id="btn-save-svg" disabled');
  assertStringIncludes(html, 'id="btn-save-png" disabled');
});

Deno.test("escapeHtml encodes markup", () => {
  assertEquals(escapeHtml(`<script>alert("x")</script>`), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  assert(escapeHtml("a & b").includes("&amp;"));
});
