/**
 * Optional golden run of generated `.xq` under BaseX when the engine is installed.
 *
 * Install hints: docs/agents/xquery-engine.md
 */
import { assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import {
  applyExpressionEdit,
  createEmptyModel,
  upsertLoop,
} from "@intehrgrator/core/mapping_model/mod.ts";
import { generateXQuery } from "@intehrgrator/core/codegen/xquery.ts";

const BASEX_CMD = Deno.env.get("BASEX_CMD") ?? "basex";

async function basexAvailable(): Promise<boolean> {
  try {
    const cmd = new Deno.Command(BASEX_CMD, {
      args: ["-q", "1"],
      stdout: "piped",
      stderr: "piped",
    });
    const out = await cmd.output();
    return out.success && new TextDecoder().decode(out.stdout).trim() === "1";
  } catch {
    return false;
  }
}

/** Replace external $source with an inline JSON map for a self-contained BaseX run. */
function bindSourceInline(xq: string, sourceJson: string): string {
  const escaped = sourceJson.replace(/\\/g, "\\\\").replace(/'/g, "''");
  return xq.replace(
    "declare variable $source external;",
    `declare variable $source as map(*) := parse-json('${escaped}');`,
  );
}

Deno.test({
  name: "BaseX runs generated for_each_source XQuery against JSON source (optional)",
  ignore: false,
  async fn() {
    if (!(await basexAvailable())) {
      console.warn(
        `skip: ${BASEX_CMD} not found — install BaseX to enable XQuery engine golden tests (see docs/agents/xquery-engine.md)`,
      );
      return;
    }

    let model = createEmptyModel("pulse-series");
    model = upsertLoop(model, {
      attachSlotId: "evt-1",
      varName: "measurements",
      path: "$.measurements",
      kind: "source",
    });
    model = applyExpressionEdit(model, "slot/rate", 'xpathNumber("pulse")', {
      rmType: "DV_QUANTITY",
      returnType: "number",
    });
    model = applyExpressionEdit(model, "slot/time", 'xpathString("timestamp")', {
      rmType: "DV_DATE_TIME",
      returnType: "string",
    });

    const source = await Deno.readTextFile(
      join(import.meta.dirname!, "fixtures/legacy-simulated-json/instances-series/bp-series-inst.json"),
    );
    const xq = bindSourceInline(generateXQuery(model), source);

    const dir = await Deno.makeTempDir({ prefix: "intehrgrator-xq-" });
    const queryPath = join(dir, "convert.xq");
    await Deno.writeTextFile(queryPath, xq);
    try {
      const result = await new Deno.Command(BASEX_CMD, {
        args: [queryPath],
        stdout: "piped",
        stderr: "piped",
      }).output();
      const stderr = new TextDecoder().decode(result.stderr);
      const stdout = new TextDecoder().decode(result.stdout);
      assertEquals(result.success, true, stderr || stdout);
      assertStringIncludes(stdout, "<mapping-result");
      assertStringIncludes(stdout, 'attach-slot-id="evt-1"');
      assertStringIncludes(stdout, "<rm:magnitude>72</rm:magnitude>");
      assertStringIncludes(stdout, "<rm:magnitude>76</rm:magnitude>");
      assertStringIncludes(stdout, "2026-07-02T08:30:00Z");
    } finally {
      await Deno.remove(dir, { recursive: true });
    }
  },
});
