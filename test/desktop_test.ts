import { assertEquals, assertThrows } from "@std/assert";
import { join } from "@std/path";
import { resolveWebRoot } from "../src/desktop/web_root.ts";
import { workbenchHandler } from "../src/desktop/serve.ts";

Deno.test("resolveWebRoot prefers www/ next to the entry", async () => {
  const dir = await Deno.makeTempDir();
  try {
    await Deno.mkdir(join(dir, "www"));
    await Deno.writeTextFile(join(dir, "www", "index.html"), "<html>www</html>");
    assertEquals(resolveWebRoot(dir), join(dir, "www"));
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
    assertEquals(resolveWebRoot(meta), join(root, "dist"));
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

Deno.test("workbenchHandler serves index.html from the web root", async () => {
  const dir = await Deno.makeTempDir();
  try {
    await Deno.writeTextFile(join(dir, "index.html"), "<html>workbench</html>");
    const res = await workbenchHandler(dir)(new Request("http://127.0.0.1/"));
    assertEquals(res.status, 200);
    assertEquals(await res.text(), "<html>workbench</html>");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});
