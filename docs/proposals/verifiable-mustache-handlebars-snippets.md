# Verifiable Mustache / Handlebars snippets in mappings

**Status:** Investigation 2026-09-10; **accepted** as [ADR 0009](../adr/0009-verifiable-handlebars-dialect.md) (editor dialect + convert-time `knownHelpersOnly`). Lint UI is [#40](https://github.com/regionstockholm/intehrgrator/issues/40).  
**Related:** [formal-verification-export.md](../future/formal-verification-export.md), [decision-tables-for-mapping.md](../future/decision-tables-for-mapping.md), VMS in `src/blockly/vms.ts`, Kintegrate helpers in `src/core/output/handlebars_dialect.ts`.

## Verdict

1. **Mustache is not fully verifiable as specified.** Lambdas (optional spec module) and recursive partials are opaque / unbounded. A **restricted Mustache** (plain JSON context, no lambdas, no partials or acyclic static partials only) *is* a small declarative interpolator and is the right dialect for decision-table text cells.
2. **The lung-MDT PROD/QA scripts do not use Handlebars’s hostile holes** (unregistered JS helpers, `#log`, `lookup`, `#with`, partials, `{{{…}}}`, `json`/`slot`). They **do** use a closed Kintegrate helper set that Mustache cannot express (`#if`/`#else`/`#unless`, `eq`/`ne`/`and`/`or`, `toLowerCase`, `#each`, `@last`, `~`). That set is **pure and lintable**, but the nested `#if` trees are a poor verification *surface* — move the branching into decision tables and keep snippets interpolating.
3. **Decision table + Mustache-level snippet** (the regimen/dose grid) is the intended product shape: the table is the logic; `{{regim}}` is dataflow.

---

## 1. Is Mustache fully verifiable?

No. The [Mustache spec](https://github.com/mustache/spec) is “logic-less” only relative to Handlebars helpers. Spec constructs:

| Construct | Verifiable if… | Hole |
|-----------|----------------|------|
| `{{name}}` / dotted names / `{{.}}` | Context is plain JSON, paths literal | — |
| `{{{name}}}` / `{{& name}}` | Same; note unescaped output | String identity vs HTML escape |
| `{{#section}}` / `{{^inverted}}` | Presence or list iteration bounded by input | Section = both `if` and `each` |
| `{{! comment }}` | Ignored | — |
| `{{> partial}}` | Static name, acyclic include graph | Recursive partials |
| `{{=<% %>=}}` (set delimiter) | Parse-time only | Confuses static scanners |
| **Lambdas** (optional module) | **Never** on a verification track | Context value is a function; return value is **re-parsed as template** |

Handlebars is Mustache plus **helpers** (arbitrary JS). Compile-time `knownHelpers` + `knownHelpersOnly: true` is the lock. Without it, `{{foo}}` is path vs helper vs `helperMissing`.

**Restricted Mustache** (recommended snippet dialect): interpolation + sections/inverted + comments; **forbid** lambdas, delimiter changes, and partials (or allow only named acyclic partials). Context = JSON / Map / already-evaluated slot values — never functions. That dialect compiles to `concat` + `if` + `for_each_*` in the Mapping Expression AST.

It still does **not** prove clinical meaning of prose. It does prove dataflow, definedness, and metamorphic independence (unread fields do not change the string).

---

## 2. Lung-MDT mapping scripts — what they actually use

Files (nearly the same dialect; QA has one extra `#unless @last`):

- [`examples/lung-MDT-form/mapping/Mappningsscript XML 3.2.0 (PROD).txt`](../../examples/lung-MDT-form/mapping/Mappningsscript%20XML%203.2.0%20(PROD).txt)
- [`examples/lung-MDT-form/mapping/Mappningsscript XML 3.2.1 (QA).txt`](../../examples/lung-MDT-form/mapping/Mappningsscript%20XML%203.2.1%20(QA).txt)

### Not used (the real escape-hatch holes)

`#with`, `lookup`, `#log`, partials `{{>}}`, triple-stash `{{{}}}`, `toUpperCase`, `gt`/`lt`/`gte`/`lte`, `json`, `slot`, unregistered helpers, lambdas, decorators.

### Used (closed Kintegrate / Handlebars; not Mustache)

Counts are PROD; QA is ±1 on `#unless` / `~`.

| Construct | ≈ count | Mustache? | Verification note |
|-----------|---------|-----------|-------------------|
| `{{#if path}}` (presence) | 192 | No (`{{#path}}` is the analogue) | Same as Blockly presence / `if` |
| `{{#if (eq\|ne\|and\|or …)}}` | 40 | No | Pure; maps to Mapping Expression |
| `eq` / `ne` / `and` / `or` | 35 / 5 / 69 / 27 | No | Closed helper whitelist |
| `{{else}}` | 134 | No (use inverted section) | Finite case split |
| `{{#each}}` | 59 | Section-over-array | Same grain as `for_each_source` |
| `{{#unless @last}}` | 3 | No | Loop delimiter; `@last` is Handlebars |
| `toLowerCase` | 53 | No | Pure string fn |
| `~` whitespace | 158 | No | Layout only |
| Bracket FLAT paths `[0]`, `[|value]` | everywhere | Handlebars path syntax | Literal paths — OK |

**Conclusion for these files:** they are **not** an open JS hatch. They are a **large nested Handlebars program** over a fixed helper set. Hostile constructs are absent. What blocks “formal verification of the script as a whole” is scale and control-flow-in-the-template (`#if`/`eq` trees copy-pasted across Note bodies), not Turing-complete helpers.

That matches the existing lung-MDT decision-table analysis: leave `#each` over repeating clusters; replace FIRST/COLLECT `#if` nests with tables; keep snippets as interpolators.

---

## 3. Snippets + decision tables

Target authoring (regimen / dose example):

| regim | antal_kurer | annan_regim | snippet |
|-------|-------------|-------------|---------|
| yes | yes | — | `enligt regim {{regim}}, {{antal_kurer}} kurer.` |
| yes | — | — | `enligt regim {{regim}}.` |
| — | yes | — | `, {{antal_kurer}} kurer.` |
| — | — | yes | `enligt regim {{annan_regim}}.` |
| — | — | — | `.` (if typ present) |

**Split of concerns:**

| Layer | Owns | Verification |
|-------|------|----------------|
| **Decision table** (FIRST / COLLECT, don't-care) | Which snippet fires | Completeness, uniqueness, hit policy — already the contract-shaped artefact |
| **Snippet** | How bound names are interpolated into prose | Restricted Mustache: only `{{name}}` of columns / loop vars already in scope |
| **`#each` / `for_each_source`** | Repeating clusters | Grain / cardinality, not nested `#if` |

Do **not** put `#if (eq …)` inside snippet cells. If a snippet needs a branch, it is another table row (or a nested named table). `toLowerCase` belongs on the **value** wired into the snippet (Blockly / Mapping Expression), not as a helper call inside the cell, unless the snippet dialect explicitly allows that one pure function.

This is how Handlebars snippets can sit **inside** VMS instead of beside it: the table is VMS logic; the cell is VMS-Mustache. The Template tab / `text_handlebars` use the **wider** VMS-Hbs profile (ADR 0009). Out-of-dialect text is still `trust: author` until lint is clean.

---

## Proposed dialects (for #40 / mapping-contract)

```text
VMS-Mustache (snippet cells, preferred):
  {{name}}, {{a.b}}, {{.}}, {{#list}}…{{/list}}, {{^empty}}…{{/empty}}, comments
  Context: JSON / Map / table column bindings. No lambdas, no partials, no set-delimiter.

VMS-Hbs (lint of existing Kintegrate / lung-MDT scripts):
  VMS-Mustache
  + #if / #unless / else, #each, @index/@first/@last
  + eq ne and or, toLowerCase (and the rest of createKintegrateHandlebars, minus json-over-whole-source)
  + ~ whitespace, bracket paths
  knownHelpersOnly: true

Escape hatch (unchanged):
  anything else — lookup, #with, #log, partials, {{{}}}, json of arbitrary context,
  unregistered helpers, text_code LANG ∈ {javascript, typescript, go-template, …}
```

**Runtime:** compile with `knownHelpersOnly` against the matching whitelist (ADR 0009). Parse with `Handlebars.parse` and **warn in the editor** (debounced); **fail convert** on unknown helpers.

**Contract export:** snippet → dataflow edges (which names are read); table → hit-policy invariants; do not treat the assembled Note string as an OPT-valid RM tree.

---

## 4. Is VMS-Hbs the same syntax as the Mustache subset?

**No.** Same `{{…}}` braces; different tag language.

| | VMS-Mustache (snippet cells) | VMS-Hbs (Template tab, `text_handlebars`) |
|--|------------------------------|-------------------------------------------|
| Iterate a list | `{{#items}}…{{/items}}` | that, **or** `{{#each items}}` |
| Presence | `{{#name}}` / `{{^name}}` | that, **or** `{{#if name}}` / `{{#unless}}` / `{{else}}` |
| Compare / boolean | not in dialect (use a table row) | `{{#if (eq x "MR")}}`, `and` / `or` / `ne` |
| Case | pre-lower the bound value | `{{toLowerCase x}}` |
| Loop glue | not needed in a cell | `{{#unless @last}}` |
| Whitespace | ordinary | `{{~` / `~}}` |
| Valid in the other profile? | Yes — VMS-Mustache ⊂ VMS-Hbs | **No** — a Mustache engine will not parse `#if` / `#each` / helpers |

Handlebars can parse Mustache. Mustache cannot parse VMS-Hbs. Lung-MDT is VMS-Hbs, not Mustache.

---

## 5. Editor lint (not a highlighter)

Today’s CodeMirror Handlebars mode is a **StreamLanguage** that colours `{{` / `#word` / `else`. It is not `@codemirror/lang-handlebars`, and it does **not** know helpers from paths. Narrowing that tokenizer would still accept `{{#with}}` and `{{lookup}}`.

Do this instead:

- Shared checker: `Handlebars.parse` + AST walk against the VMS-Hbs (or VMS-Mustache) whitelist.
- Surface: [`@codemirror/lint`](https://github.com/codemirror/lint) `linter(source, { delay: 500 })` — default delay is 750 ms — **warning** diagnostics (underline + tooltip). `autoPanel: false`.
- Panes: Handlebars Template tab, inline `text_code` when LANG is `handlebars`, `text_handlebars` script field, later snippet cells.
- Convert-time `knownHelpersOnly` is the hard gate; lint is the author-facing copy of that gate.

---

## What this does *not* claim

- Mustache/Handlebars prose preserves clinical *meaning* (only that declared inputs explain the string).
- OPT `TemplateValidator` on the snippet text (validate after parse to XML/JSON, if that is the product).
- A Dafny proof of nested `#if` in the current PROD script — falsify via PBT/gold Notes; *reauthor* the branches as tables for UNIQUE/COLLECT checks.

## Pointers

- [ADR 0009](../adr/0009-verifiable-handlebars-dialect.md) — editors + convert only VMS-Hbs.
- VMS Blockly hatch list ([`src/blockly/vms.ts`](../../src/blockly/vms.ts)) still names `text_handlebars` / `text_code`; [#40](https://github.com/regionstockholm/intehrgrator/issues/40) should warn on **out-of-dialect** Handlebars and on non-Handlebars `text_code` LANG, not on in-dialect VMS-Hbs.
- Product slices for tables: [decision-tables-for-mapping.md](../future/decision-tables-for-mapping.md) § Incremental slices (snippet output columns = slice 5).
