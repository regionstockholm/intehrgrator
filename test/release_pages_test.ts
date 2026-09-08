import { assertEquals, assertRejects } from "@std/assert";
import { join } from "@std/path";
import {
  assembleMainPagesSite,
  assembleReleasePagesSite,
  normalizeManifest,
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
