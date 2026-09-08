import { assertEquals, assertRejects } from "@std/assert";
import { join } from "@std/path";
import {
  assembleMainPagesSite,
  assembleReleasePagesSite,
  flattenWgetNest,
  normalizeManifest,
  pagesRepoPathDepth,
  versionHasIndex,
  VERSIONS_MANIFEST,
} from "../scripts/pages_site.ts";
import {
  readVersionFromDenoJson,
  releaseTagForVersion,
} from "../scripts/release_version.ts";

Deno.test("releaseTagForVersion matches existing tag scheme", () => {
  assertEquals(releaseTagForVersion("0.5.0"), "v0.5");
  assertEquals(releaseTagForVersion("0.2.1"), "v0.2.1");
  assertEquals(releaseTagForVersion("1.0.0"), "v1.0");
  assertEquals(releaseTagForVersion("0.6.1"), "v0.6.1");
});

Deno.test("readVersionFromDenoJson", () => {
  assertEquals(readVersionFromDenoJson(`{"version":"0.6.0"}`), "0.6.0");
});

Deno.test("normalizeManifest deduplicates and sorts versions", () => {
  assertEquals(
    normalizeManifest({ versions: ["v0.4", "v0.5", "v0.5", "bad", 3] }),
    { versions: ["v0.5", "v0.4"] },
  );
});

Deno.test("pagesRepoPathDepth counts project path segments", () => {
  assertEquals(pagesRepoPathDepth("https://regionstockholm.github.io/intehrgrator"), 1);
  assertEquals(pagesRepoPathDepth("https://regionstockholm.github.io/intehrgrator/"), 1);
  assertEquals(pagesRepoPathDepth("https://example.github.io/"), 0);
});

Deno.test("flattenWgetNest lifts nested files to dest root", async () => {
  const dest = await Deno.makeTempDir();
  await Deno.mkdir(join(dest, "v0.6", "wasm"), { recursive: true });
  await Deno.writeTextFile(join(dest, "v0.6", "index.html"), "<html>ok</html>");
  await Deno.writeTextFile(join(dest, "v0.6", "wasm", "a.js"), "1");
  await flattenWgetNest(dest, "v0.6");
  assertEquals(await Deno.readTextFile(join(dest, "index.html")), "<html>ok</html>");
  assertEquals(await Deno.readTextFile(join(dest, "wasm", "a.js")), "1");
  let nestedGone = false;
  try {
    await Deno.stat(join(dest, "v0.6"));
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) nestedGone = true;
    else throw error;
  }
  assertEquals(nestedGone, true);
});

Deno.test("versionHasIndex detects index.html under a tag", async () => {
  const root = await Deno.makeTempDir();
  await Deno.mkdir(join(root, "v0.6"), { recursive: true });
  assertEquals(await versionHasIndex(root, "v0.6"), false);
  await Deno.writeTextFile(join(root, "v0.6", "index.html"), "<html/>");
  assertEquals(await versionHasIndex(root, "v0.6"), true);
});

Deno.test("assembleMainPagesSite copies root dist and writes manifest", async () => {
  const dir = await Deno.makeTempDir();
  const rootDist = join(dir, "root-dist");
  const outDir = join(dir, "out");
  await Deno.mkdir(rootDist, { recursive: true });
  await Deno.writeTextFile(join(rootDist, "index.html"), "<html>main</html>");

  const manifest = await assembleMainPagesSite({
    baseUrl: "https://example.invalid/intehrgrator",
    rootDist,
    outDir,
  });

  assertEquals(manifest.versions, []);
  assertEquals(await Deno.readTextFile(join(outDir, "index.html")), "<html>main</html>");
  assertEquals(
    JSON.parse(await Deno.readTextFile(join(outDir, VERSIONS_MANIFEST))).versions,
    [],
  );
});

Deno.test("assembleMainPagesSite drops listed versions that fail to mirror", async () => {
  const dir = await Deno.makeTempDir();
  const rootDist = join(dir, "root-dist");
  const outDir = join(dir, "out");
  await Deno.mkdir(rootDist, { recursive: true });
  await Deno.writeTextFile(join(rootDist, "index.html"), "<html>main</html>");

  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.endsWith("/versions.json")) {
      return Promise.resolve(
        new Response(JSON.stringify({ versions: ["v0.6"] }), { status: 200 }),
      );
    }
    return originalFetch(input);
  }) as typeof fetch;

  try {
    const manifest = await assembleMainPagesSite({
      baseUrl: "https://example.invalid/intehrgrator",
      rootDist,
      outDir,
    });
    assertEquals(manifest.versions, []);
    assertEquals(
      JSON.parse(await Deno.readTextFile(join(outDir, VERSIONS_MANIFEST))).versions,
      [],
    );
    assertEquals(await versionHasIndex(outDir, "v0.6"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("assembleReleasePagesSite rejects duplicate version tags", async () => {
  const dir = await Deno.makeTempDir();
  const versionDist = join(dir, "version-dist");
  const outDir = join(dir, "out");
  await Deno.mkdir(versionDist, { recursive: true });
  await Deno.writeTextFile(join(versionDist, "index.html"), "<html>v0.6</html>");

  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.endsWith("/versions.json")) {
      return Promise.resolve(
        new Response(JSON.stringify({ versions: ["v0.6"] }), { status: 200 }),
      );
    }
    return originalFetch(input);
  }) as typeof fetch;

  try {
    await assertRejects(
      () =>
        assembleReleasePagesSite({
          baseUrl: "https://example.invalid/intehrgrator",
          versionTag: "v0.6",
          versionDist,
          outDir,
        }),
      Error,
      "already exists",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("assembleReleasePagesSite adds new version and drops broken listed ones", async () => {
  const nestedRoot = await Deno.makeTempDir();
  const projectDir = join(nestedRoot, "intehrgrator");
  await Deno.mkdir(projectDir, { recursive: true });
  await Deno.writeTextFile(join(projectDir, "index.html"), "<html>live</html>");
  await Deno.writeTextFile(
    join(projectDir, "versions.json"),
    JSON.stringify({ versions: ["v0.6"] }, null, 2),
  );

  const live = Deno.serve({ port: 0, hostname: "127.0.0.1" }, async (req) => {
    const url = new URL(req.url);
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith("/")) rel += "index.html";
    const filePath = join(nestedRoot, rel);
    try {
      const data = await Deno.readFile(filePath);
      return new Response(data, { status: 200 });
    } catch {
      return new Response("missing", { status: 404 });
    }
  });

  const dir = await Deno.makeTempDir();
  const versionDist = join(dir, "version-dist");
  const outDir = join(dir, "out");
  await Deno.mkdir(versionDist, { recursive: true });
  await Deno.writeTextFile(join(versionDist, "index.html"), "<html>v0.6.1</html>");
  await Deno.writeTextFile(join(versionDist, "bundle.js"), "ok");

  const liveBase = `http://127.0.0.1:${live.addr.port}/intehrgrator`;
  try {
    const manifest = await assembleReleasePagesSite({
      baseUrl: liveBase,
      versionTag: "v0.6.1",
      versionDist,
      outDir,
    });
    assertEquals(manifest.versions, ["v0.6.1"]);
    assertEquals(await Deno.readTextFile(join(outDir, "v0.6.1", "index.html")), "<html>v0.6.1</html>");
    assertEquals(await versionHasIndex(outDir, "v0.6"), false);
    assertEquals(await Deno.readTextFile(join(outDir, "index.html")), "<html>live</html>");
  } finally {
    await live.shutdown();
  }
});
