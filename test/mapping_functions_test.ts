/**
 * Blockly Functions are first-class Mapping Model + codegen, not a VMS hatch.
 * Value call sites serialize as Mapping Expression `call("name", …)` and
 * Conversion scripts emit a reusable named function where the dialect allows it.
 */
import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import * as enMsg from "blockly/msg/en";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import { initBlocklyGenerators, workspaceToModelJson } from "@intehrgrator/blockly/mod.ts";
import { blockToExpression } from "@intehrgrator/blockly/expression_serialize.ts";
import { applyExpressionEdit, createEmptyModel } from "@intehrgrator/core/mapping_model/mod.ts";
import { generate } from "@intehrgrator/core/codegen/mod.ts";
import { generateGoTemplate } from "@intehrgrator/core/codegen/go_template.ts";
import { createSourceContext, evaluate } from "@intehrgrator/core/source/query_runtime.ts";
import { parseExpression, serialize, validateExpressionSource } from "@intehrgrator/core/expression/mod.ts";
import type { MappingFunction } from "@intehrgrator/types/mod.ts";

let ready = false;
function ensure(): void {
  if (ready) return;
  const anyMod = enMsg as { default?: Record<string, string> } & Record<string, string>;
  const table = anyMod.default && typeof anyMod.default === "object" ? anyMod.default : anyMod;
  Blockly.setLocale(table);
  initBlocklyGenerators();
  ready = true;
}

const GREET: MappingFunction = {
  name: "greet",
  kind: "return",
  params: ["who"],
  body: 'concat("Hello ", var("who"))',
};

function modelWithGreetCalls(): ReturnType<typeof createEmptyModel> {
  let model = createEmptyModel("fn-demo");
  model.targetFormat = "json-schema";
  model = applyExpressionEdit(model, "s1", 'call("greet", "Ada")', {
    rmType: "string",
    returnType: "string",
    label: "one",
  });
  model = applyExpressionEdit(model, "s2", 'call("greet", "Bo")', {
    rmType: "string",
    returnType: "string",
    label: "two",
  });
  model.functions = [GREET];
  return model;
}

Deno.test("call is a Mapping Expression builtin (never function()", () => {
  const src = 'call("greet", var("who"))';
  const ast = parseExpression(src);
  assertEquals(serialize(ast), src);
  assertEquals(validateExpressionSource(src), null);
  assertEquals(validateExpressionSource("function greet() {}") !== null, true);
});

Deno.test("procedures_callreturn serializes as call() and is not an escape hatch", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const def = workspace.newBlock("procedures_defreturn");
  def.setFieldValue("greet", "NAME");
  const body = workspace.newBlock("text");
  body.setFieldValue("hello", "TEXT");
  const ret = def.getInput("RETURN") ?? def.getInput("VALUE");
  ret!.connection!.connect(body.outputConnection!);

  const slot = workspace.newBlock("target_value");
  slot.setFieldValue("slot/fn", "SLOT_ID");
  const call = workspace.newBlock("procedures_callreturn");
  call.setFieldValue("greet", "NAME");
  slot.getInput("VALUE")!.connection!.connect(call.outputConnection!);

  assertEquals(blockToExpression(call), 'call("greet")');
  const ir = workspaceToModelJson(workspace);
  assertEquals(
    ir.unsupported.some((u) => u.blockType.startsWith("procedures_")),
    false,
    JSON.stringify(ir.unsupported),
  );
  assertEquals(ir.functions, [{ name: "greet", kind: "return", params: [], body: '"hello"' }]);
  assertEquals(ir.slots.find((s) => s.slotId === "slot/fn")?.expression, 'call("greet")');
  workspace.dispose();
});

Deno.test("Test Run evaluates call() against Mapping Model functions", () => {
  const ctx = createSourceContext("{}", "json");
  ctx.functions = [GREET];
  assertEquals(evaluate('call("greet", "Ada")', ctx, "string"), "Hello Ada");
});

Deno.test("TypeScript / Java / XQuery emit a reusable named function, not an inlined body", () => {
  const model = modelWithGreetCalls();
  const ts = generate(model, "typescript");
  assertStringIncludes(ts, "function fn_greet(");
  assertEquals(ts.split("function fn_greet(").length - 1, 1, "one TypeScript helper");
  assertEquals(ts.split('fn_greet("Ada")').length - 1, 1);
  assertEquals(ts.split('fn_greet("Bo")').length - 1, 1);
  assertEquals(ts.includes('["Hello ", "Ada"].join("")'), false);

  const java = generate(model, "java");
  assertStringIncludes(java, "private Object fn_greet(");
  assertEquals(java.split("private Object fn_greet(").length - 1, 1);
  assertStringIncludes(java, 'fn_greet("Ada")');
  assertStringIncludes(java, 'fn_greet("Bo")');

  const xq = generate(model, "xquery");
  assertStringIncludes(xq, "declare function local:greet(");
  assertEquals(xq.split("declare function local:greet(").length - 1, 1);
  assertStringIncludes(xq, 'local:greet("Ada")');
  assertStringIncludes(xq, 'local:greet("Bo")');
});

Deno.test("VMS-Go emits acyclic define/template, not the call builtin", () => {
  const model = modelWithGreetCalls();
  const go = generateGoTemplate(model);
  assertStringIncludes(go, '{{- define "greet" -}}');
  assertEquals(go.split('{{- define "greet" -}}').length - 1, 1);
  assertStringIncludes(go, 'template "greet" (dict "who" "Ada")');
  assertStringIncludes(go, 'template "greet" (dict "who" "Bo")');
  assertEquals(go.includes("{{call "), false);
  assertEquals(go.includes("(template "), false);
});
