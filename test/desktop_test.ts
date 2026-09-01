import { assertEquals, assertThrows } from "@std/assert";
import { join } from "@std/path";
import { workbenchOrErrorHandler } from "../src/desktop/main.ts";
import { errorPageHandler, workbenchHandler } from "../src/desktop/serve.ts";
import { resolveWebRoot } from "../src/desktop/web_root.ts";

Deno.test("resolveWebRoot prefers www/ next to the entry", async () => {
  const dir = await Deno.makeTempDir();
  try {
    await Deno.mkdir(join(dir, "www"));
    await Deno.writeTextFile(join(dir, "www", "index.html"), "<html>www</html>");
    assertEquals(
      resolveWebRoot(dir).replaceAll("\\", "/"),
      join(dir, "www").replaceAll("\\", "/"),
    );
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("resolveWebRoot falls back to ../../dist", async () => {
  const root = await Deno.makeTempDir();
  try {
    const meta = join(root, "src", "desktop");
    await Deno.mkdir(meta, { recursive: true });
    await Deno.mkdir(join(root, "dist"));
    await Deno.writeTextFile(join(root, "dist", "index.html"), "<html>dist</html>");
    assertEquals(
      resolveWebRoot(meta).replaceAll("\\", "/"),
      join(root, "dist").replaceAll("\\", "/"),
    );
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("resolveWebRoot throws when assets are missing", async () => {
  const dir = await Deno.makeTempDir();
  try {
    assertThrows(() => resolveWebRoot(dir), Error, "Workbench assets not found");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("workbenchOrErrorHandler serves an HTML error page when assets are missing", async () => {
  const dir = await Deno.makeTempDir();
  try {
    const res = await workbenchOrErrorHandler(dir, new URL("file:///no-such-entry/main.ts").href)(
      new Request("http://127.0.0.1/"),
    );
    assertEquals(res.status, 200);
    const text = await res.text();
    assertEquals(text.includes("intEHRgrator could not start"), true);
    assertEquals(text.includes("Workbench assets not found"), true);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("errorPageHandler is a 200 HTML page", async () => {
  const res = await errorPageHandler("boom")(new Request("http://127.0.0.1/"));
  assertEquals(res.status, 200);
  assertEquals((await res.text()).includes("boom"), true);
});

Deno.test("workbenchHandler serves staged *.js.dat as the original .js URL", async () => {
  const dir = await Deno.makeTempDir();
  try {
    await Deno.writeTextFile(join(dir, "index.html"), "<script src=bundle.js></script>");
    await Deno.writeTextFile(join(dir, "bundle.js.dat"), "console.log('ok')");
    const page = await workbenchHandler(dir)(new Request("http://127.0.0.1/"));
    assertEquals(page.status, 200);
    const js = await workbenchHandler(dir)(new Request("http://127.0.0.1/bundle.js"));
    assertEquals(js.status, 200);
    assertEquals(await js.text(), "console.log('ok')");
    assertEquals(js.headers.get("content-type"), "text/javascript; charset=utf-8");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("workbenchHandler serves index.html with desktop marker injected", async () => {
  const dir = await Deno.makeTempDir();
  try {
    await Deno.writeTextFile(join(dir, "index.html"), "<!doctype html><html><head><title>Test</title></head><body>workbench</body></html>");
    const res = await workbenchHandler(dir)(new Request("http://127.0.0.1/"));
    assertEquals(res.status, 200);
    const html = await res.text();
    assertEquals(html.includes("<script>window.__INTEHR_DESKTOP__=true;</script>"), true);
    assertEquals(html.includes("workbench"), true);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("isDesktopEnvironment accurately checks desktop global", async () => {
  const { isDesktopEnvironment } = await import("../src/web/agent_bridge.ts");
  const g = globalThis as unknown as { __INTEHR_DESKTOP__?: boolean };
  const prev = g.__INTEHR_DESKTOP__;
  try {
    delete g.__INTEHR_DESKTOP__;
    assertEquals(isDesktopEnvironment(), false);
    g.__INTEHR_DESKTOP__ = true;
    assertEquals(isDesktopEnvironment(), true);
  } finally {
    if (prev !== undefined) {
      g.__INTEHR_DESKTOP__ = prev;
    } else {
      delete g.__INTEHR_DESKTOP__;
    }
  }
});
