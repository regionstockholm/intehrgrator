# Source context root vs Blockly `for_each_source`

## Decision

**Do not port kintegrate’s “Frame this node as context root” as a Source Pane tree feature.**

intEHRgrator already scopes iteration explicitly with Blockly (`for_each_source`, and stock `controls_forEach` / variables). That covers the need that makes context roots essential in Handlebars-based kintegrate.

## What kintegrate’s feature does

In [kintegrate](https://github.com/ErikSundvall/kintegrate) Integration Builder (DeepWiki: JSON Tree Viewer / path generation):

| Concern | Behavior |
|---------|----------|
| UI | Right-click tree node → “Set as context boundary” / remove |
| State | `ExtendedTree.setContextBoundary(nodeId, boolean)` |
| Path gen | `buildHandlebarsPath` / `buildHandlebarsTree` call `findNearestContextBoundary` and emit paths **relative** to that ancestor |
| Why | Handlebars `{{#with}}` / `{{#each}}` make inner paths relative to the current context; click-to-insert must match that implicit scope |

Context roots are a **tree-side framing** so relative Handlebars paths stay correct inside those blocks.

## Why Blockly makes tree framing mostly unnecessary

| kintegrate | intEHRgrator |
|------------|--------------|
| Implicit Handlebars context | Explicit loop / variable blocks |
| Relative path strings by default inside `{{#each}}` | `source_query` uses document-rooted fontoxpath (`$…` / `/…`) against `sourceCtx` |
| Tree menu marks the `{{#with}}` boundary | `for_each_source` binds `VAR` from `PATH` via `evaluateXPathToNodes` and stores the node in `__vars[name]` |

Click-to-Map today always inserts an absolute source path through the [Source Format Handler](../SOURCE_FORMATS.md#source-format-handler). Nested mapping under a loop is authored by:

1. Placing `for_each_source` with an absolute multi-node `PATH`
2. Using the loop variable (and/or absolute `source_query` paths) inside the body

No separate “frame this node” tree state is required for that workflow.

## Residual gap (optional, Blockly-scoped — not a tree context root)

If Click-to-Map while a listening slot sits **inside** a `for_each_source` body should insert a **relative** path evaluated against the current loop node, that is a Blockly-scope concern:

- Detect nearest enclosing `for_each_source` (or equivalent `with`)
- Relativize the clicked path against the loop `PATH`
- Optionally evaluate nested `source_query` with context node = `__vars[VAR]` instead of document root

That is **not** the same as persisting a context-boundary mark on the Source Schema tree. Prefer Blockly ancestry over kintegrate-style tree framing.

### Interface sketch (only if product asks for relative Click-to-Map)

```ts
/** Resolved when Click-to-Map runs inside a source loop / with block. */
interface SourceIterationScope {
  /** Blockly block id of the enclosing for_each_source (or future with_source). */
  blockId: string;
  /** Absolute fontoxpath of the iterated nodes (for_each_source PATH). */
  iterationPath: string;
  /** Variable name bound to the current node. */
  varName: string;
}

interface RelativeSourceBind {
  /** Absolute path of the clicked tree node. */
  absolutePath: string;
  /** Path relative to iterationPath, suitable for eval against the loop node. */
  relativePath: string;
  scope: SourceIterationScope;
}

// Workbench / Source Format Handler extension points (future):
// findEnclosingSourceIteration(workspace, slotBlockId): SourceIterationScope | null
// relativizeSourcePath(absolutePath, scope.iterationPath, format): string
// handler.evaluate(expr, ctx, returnType, { contextNode?: unknown })
```

Until relative bind is implemented, document absolute paths + `for_each_source` as the supported pattern.

## Related

- [BLOCKLY_INTEGRATION.md](../BLOCKLY_INTEGRATION.md) — `for_each_source`
- [SOURCE_FORMATS.md](../SOURCE_FORMATS.md) — Source Format Handler
- [SOURCE_QUERY.md](../SOURCE_QUERY.md) — fontoxpath evaluators
- Architecture review candidate 1 — `docs/reviews/architecture-review-openehr-source-dual-builds.html`
