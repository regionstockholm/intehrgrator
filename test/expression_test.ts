import { assertEquals, assertExists } from "@std/assert";
import { parseExpression, serialize, validateExpressionSource } from "@intehrgrator/core/expression/mod.ts";

Deno.test("expression parse and serialize round-trip", () => {
  const src = 'trim(xpathNumber("/vitals[1]/systolic"))';
  const ast = parseExpression(src);
  assertEquals(serialize(ast), src);
});

Deno.test("expression rejects import", () => {
  const err = validateExpressionSource('import fs from "fs"');
  assertExists(err);
});

Deno.test("if expression", () => {
  const ast = parseExpression('if(xpathBoolean("/active"), xpathNumber("/a"), xpathNumber("/b"))');
  assertEquals(ast.kind, "call");
});
