import { assert, assertEquals } from "@std/assert";
import {
  DEFAULT_GITHUB_EXAMPLES_URL,
  isGitHubExamplesDirectoryUrl,
  loadGitHubExampleDirectory,
  parseGitHubExamplesDirectoryUrl,
} from "@intehrgrator/core/source/github_examples.ts";
import { mockGithubFetch } from "./github_mock.ts";

Deno.test("parseGitHubExamplesDirectoryUrl reads tree URLs with folder path", () => {
  const ref = parseGitHubExamplesDirectoryUrl(DEFAULT_GITHUB_EXAMPLES_URL);
  assertEquals(ref.owner, "Ehrlibs");
  assertEquals(ref.repo, "openEHR-model-examples");
  assertEquals(ref.ref, "main");
  assertEquals(
    ref.pathPrefix,
    "local/theme-packs/sport-event-details/instances",
  );
});

Deno.test("isGitHubExamplesDirectoryUrl accepts tree links and owner/repo specs", () => {
  assertEquals(isGitHubExamplesDirectoryUrl(DEFAULT_GITHUB_EXAMPLES_URL), true);
  assertEquals(isGitHubExamplesDirectoryUrl("Ehrlibs/openEHR-model-examples@main:instances"), true);
  assertEquals(isGitHubExamplesDirectoryUrl("https://example.test/instances"), false);
});

Deno.test("loadGitHubExampleDirectory fetches JSON and XML under a prefix", async () => {
  const files = {
    "local/instances/a.json": '{"a":1}',
    "local/instances/b.xml": "<x/>",
    "local/instances/readme.txt": "skip",
    "local/other/c.json": '{"c":1}',
  };
  const url = "https://github.com/org/repo/tree/main/local/instances";
  const loaded = await loadGitHubExampleDirectory(url, {
    fetch: mockGithubFetch(files),
  });
  assertEquals(loaded.files.length, 2);
  assertEquals(loaded.files[0]?.name, "a.json");
  assertEquals(loaded.files[1]?.name, "b.xml");
  assert(loaded.warnings.length === 0);
});
