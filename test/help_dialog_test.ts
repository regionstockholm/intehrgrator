import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { dirname, fromFileUrl, join } from "@std/path";
import { HELP_LINKS } from "../src/ui/help_links.ts";
import { diagnosticsText, sessionOrigin } from "../src/ui/help_dialog.ts";

const root = join(dirname(fromFileUrl(import.meta.url)), "..");

async function read(rel: string): Promise<string> {
  return await Deno.readTextFile(join(root, rel));
}

Deno.test("diagnosticsText joins version and origin", () => {
  assertEquals(
    diagnosticsText("  v0.7.2 · abc  ", "https://example.test"),
    "v0.7.2 · abc\nhttps://example.test",
  );
});

Deno.test("sessionOrigin reads location.origin", () => {
  assertEquals(sessionOrigin({ origin: "http://127.0.0.1:8765" }), "http://127.0.0.1:8765");
});

Deno.test("Help dialog, issue templates, and end-user docs stay aligned", async () => {
  const html = await read("web/index.html");
  const agents = await read("AGENTS.md");
  const readme = await read("README.md");
  const tutorial = await read("docs/TUTORIAL.md");
  const developers = await read("README-DEVELOPERS.md");
  const bug = await read(".github/ISSUE_TEMPLATE/bug.yml");
  const feature = await read(".github/ISSUE_TEMPLATE/feature.yml");
  const config = await read(".github/ISSUE_TEMPLATE/config.yml");

  assertStringIncludes(html, 'id="btn-help"');
  assertStringIncludes(html, 'id="dialog-help"');
  assertStringIncludes(html, `data-help-link="tutorial"`);
  assertStringIncludes(html, HELP_LINKS.tutorial);
  assertStringIncludes(html, HELP_LINKS.bug);
  assertStringIncludes(html, HELP_LINKS.feature);
  assertStringIncludes(html, "Feature requests are welcome");

  assertStringIncludes(bug, "name: Report a problem");
  assertStringIncludes(bug, "needs-triage");
  assertStringIncludes(feature, "name: Request a feature");
  assertStringIncludes(feature, "Feature requests are welcome");
  assertStringIncludes(config, "docs/TUTORIAL.md");

  assertStringIncludes(readme, HELP_LINKS.webShell);
  assertStringIncludes(readme, HELP_LINKS.releases);
  assertStringIncludes(readme, HELP_LINKS.versionsJson);
  assertStringIncludes(readme, "Feature requests are welcome");
  assertStringIncludes(readme, "README-DEVELOPERS.md");
  assert(!readme.includes("snarktank"));
  assert(!readme.includes("New in 0.5"));

  assertStringIncludes(tutorial, "Click-to-Map");
  assertStringIncludes(tutorial, "Appendix A");
  assertStringIncludes(tutorial, "intehrgrator-mapping");
  assertStringIncludes(tutorial, "INTEHR_AGENT_URL");

  assertStringIncludes(developers, "https://docs.deno.com/runtime/getting_started/installation/");
  assertStringIncludes(developers, "deno task vendor");
  assertStringIncludes(developers, "CONTEXT.md");
  assertStringIncludes(developers, "docs/adr/");
  assertStringIncludes(developers, "mattpocock/skills");
  assertStringIncludes(developers, "DeepWiki");

  assertStringIncludes(agents, "/grill-with-docs");
  assertStringIncludes(agents, "Matt Pocock");
  assert(!agents.includes("snarktank/ai-dev-tasks"));
  assert(!agents.includes("create-prd.md"));

  try {
    await Deno.stat(join(root, "tasks"));
    throw new Error("tasks/ directory should have been removed");
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
});
