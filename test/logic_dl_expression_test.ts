import { assertEquals } from "@std/assert";
import { parseExpression, serialize } from "@intehrgrator/core/expression/mod.ts";
import { createSourceContext, evaluate } from "@intehrgrator/core/source/query_runtime.ts";
import { emitTsExpression, createTsEmitContext } from "@intehrgrator/core/codegen/typescript.ts";
import { emitXQueryExpr } from "@intehrgrator/core/codegen/xquery.ts";

const empty = () => createSourceContext("{}", "json");

Deno.test("all_of is vacuously true on an empty list; any_of is false", () => {
  const ctx = empty();
  assertEquals(evaluate('all_of(list(), "x", true)', ctx, "boolean"), true);
  assertEquals(evaluate('any_of(list(), "x", true)', ctx, "boolean"), false);
  assertEquals(evaluate('none_of(list(), "x", true)', ctx, "boolean"), true);
});

Deno.test("all_of / any_of / none_of evaluate the predicate per item", () => {
  const ctx = empty();
  assertEquals(
    evaluate('all_of(list(1, 2, 3), "x", gt(var("x"), 0))', ctx, "boolean"),
    true,
  );
  assertEquals(
    evaluate('all_of(list(1, 0, 3), "x", gt(var("x"), 0))', ctx, "boolean"),
    false,
  );
  assertEquals(
    evaluate('any_of(list(0, 0, 4), "x", gt(var("x"), 3))', ctx, "boolean"),
    true,
  );
  assertEquals(
    evaluate('none_of(list(1, 2), "x", eq(var("x"), 9))', ctx, "boolean"),
    true,
  );
});

Deno.test("cardinality restrictions count matching items", () => {
  const ctx = empty();
  assertEquals(
    evaluate('at_least(list(1, 2, 3, 4), 3, "x", gt(var("x"), 1))', ctx, "boolean"),
    true,
  );
  assertEquals(
    evaluate('at_most(list(1, 2, 3), 1, "x", gt(var("x"), 2))', ctx, "boolean"),
    true,
  );
  assertEquals(
    evaluate('exactly(list(1, 2, 3), 2, "x", gt(var("x"), 1))', ctx, "boolean"),
    true,
  );
  assertEquals(
    evaluate('exactly(list(), 0, "x", true)', ctx, "boolean"),
    true,
  );
});

Deno.test("relative source paths in a restriction predicate walk each item", () => {
  const ctx = createSourceContext(
    JSON.stringify({ pets: [{ type: "Cat" }, { type: "Cat" }, { type: "Dog" }] }),
    "json",
  );
  assertEquals(
    evaluate('all_of(xpathNode("$.pets"), "pet", eq(xpathString("type"), "Cat"))', ctx, "boolean"),
    false,
  );
  assertEquals(
    evaluate('any_of(xpathNode("$.pets"), "pet", eq(xpathString("type"), "Dog"))', ctx, "boolean"),
    true,
  );
  assertEquals(
    evaluate('exactly(xpathNode("$.pets"), 2, "pet", eq(xpathString("type"), "Cat"))', ctx, "boolean"),
    true,
  );
  assertEquals(
    evaluate('none_of(xpathNode("$.pets"), "pet", eq(xpathString("type"), "Snake"))', ctx, "boolean"),
    true,
  );
});

Deno.test("set and/or/not are intersection, union, and complement", () => {
  const ctx = empty();
  assertEquals(evaluate('intersection(list(1, 2, 3), list(2, 3, 4))', ctx, "node"), [2, 3]);
  assertEquals(evaluate('union(list(1, 2), list(2, 3))', ctx, "node"), [1, 2, 3]);
  assertEquals(evaluate('difference(list(1, 2, 3), list(2))', ctx, "node"), [1, 3]);
});

Deno.test("boolean connectives and compare parse and evaluate", () => {
  const ctx = empty();
  assertEquals(evaluate("and(true, false)", ctx, "boolean"), false);
  assertEquals(evaluate("or(false, true)", ctx, "boolean"), true);
  assertEquals(evaluate("not(false)", ctx, "boolean"), true);
  assertEquals(evaluate('eq("a", "a")', ctx, "boolean"), true);
  assertEquals(evaluate("lt(1, 2)", ctx, "boolean"), true);
});

Deno.test("DL expressions round-trip through parse/serialize", () => {
  const src = 'all_of(xpathNode("$.pets"), "pet", eq(xpathString("type"), "Cat"))';
  assertEquals(serialize(parseExpression(src)), src);
});

Deno.test("TypeScript emit uses every/some and asList for restrictions", () => {
  const ctx = createTsEmitContext();
  const ast = parseExpression('all_of(list(1, 2), "x", gt(var("x"), 0))');
  const code = emitTsExpression(ast, ctx);
  assertEquals(ctx.helpers.has("logic"), true);
  assertEquals(code.includes("asList"), true);
  assertEquals(code.includes(".every("), true);
  assertEquals(code.includes('__vars["x"]'), true);
});

Deno.test("XQuery emit uses every/some for restrictions", () => {
  const ast = parseExpression('any_of(list(1, 2), "x", gt(var("x"), 0))');
  const xq = emitXQueryExpr(ast);
  assertEquals(xq.includes("some $x in"), true);
  assertEquals(xq.includes("$x"), true);
});
