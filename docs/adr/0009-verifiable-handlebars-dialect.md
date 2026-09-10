# Editors only accept the verifiable Handlebars dialect (VMS-Hbs)

- Status: accepted
- Date: 2026-09-10

## Context

Handlebars.js is Mustache plus **helpers** (arbitrary JavaScript). Unrestricted templates are opaque `string × context → string` and sit on the VMS escape list (`text_handlebars`, `text_code`, the **Handlebars Template** tab). Investigation of the language, the Kintegrate runtime, and the lung-MDT PROD/QA scripts is in [verifiable-mustache-handlebars-snippets.md](../proposals/verifiable-mustache-handlebars-snippets.md).

Those scripts do **not** use the hostile holes (`lookup`, `#with`, `#log`, partials, lambdas, unregistered helpers). They use a **closed** helper set that is already registered in `createKintegrateHandlebars()`. Nested `#if`/`eq` is a poor *authoring* surface (decision tables + interpolating snippets are preferred) but it is still a finite, pure dialect — not an open JS hatch.

CodeMirror in the workbench (`src/workbench/codemirror_setup.ts`) only **token-colours** `{{…}}`. There is no Handlebars grammar checker. Restricting the highlighter cannot enforce a helper whitelist.

## Decision

1. **Authoring surface.** Every Handlebars editor — Handlebars Template tab, `text_code` with LANG `handlebars`, `text_handlebars` script input, and future decision-table snippet cells — accepts only **VMS-Hbs** (whitelist below). Full Handlebars.js is not a product language.
2. **Hard gate at convert.** `renderHandlebars` / compile uses `knownHelpersOnly: true` against that whitelist. Unknown helpers, partials, `lookup`, `#with`, `#log`, delimiter changes, and lambdas **do not run**.
3. **Soft gate while typing.** Debounced lint (`@codemirror/lint`, `delay` ≈ 500–750 ms) on those panes: **warning** severity (yellow underline / tooltip), not a keystroke block and not an error panel that looks like a broken mapping. Same family as **Constraint warning**. Blockly / Mapping Spec rows that contain out-of-dialect Handlebars keep a hatch warning ([#40](https://github.com/regionstockholm/intehrgrator/issues/40)).
4. **Two profiles, one parser.** Handlebars.parse understands both. **VMS-Hbs** is the editor/runtime dialect (Kintegrate / lung-MDT). **VMS-Mustache** is the stricter profile for **decision-table snippet cells** (interpolation + Mustache sections only). VMS-Mustache ⊂ VMS-Hbs. They are **not the same syntax** — see Consequences.

### VMS-Hbs whitelist

Allowed: `{{path}}` (including bracket FLAT keys), comments, `~` whitespace, `{{else}}`, `{{#if}}` / `{{#unless}}` / `{{#each}}`, `@index` / `@first` / `@last` / `@key`, subexpressions of `eq` `ne` `lt` `gt` `lte` `gte` `and` `or`, `toLowerCase` `toUpperCase`, `slot` (named Mapping Model slot). Mustache-style `{{#path}}` / `{{^path}}` sections remain legal (Handlebars `blockHelperMissing` on a path).

Forbidden: `lookup`, `#with`, `#log`, partials `{{>}}`, `{{{…}}}` / `{{&}}`, `json` of an arbitrary context, set-delimiter, decorators, unregistered helpers, context lambdas.

`json` stays out of the editor dialect (it re-couples unread fields). Built-in `with` / `lookup` / `log` are Handlebars defaults and must be **dropped** from `knownHelpers`, not inherited.

## Consequences

- In-dialect Handlebars is **VMS**, not `trust: author`. Out-of-dialect text is still an escape hatch until the author fixes it; convert fails closed rather than calling `helperMissing`.
- **Mustache vs VMS-Hbs syntax:** a VMS-Mustache snippet (`{{regim}}`, `{{#items}}…{{/items}}`) is valid VMS-Hbs. VMS-Hbs (`{{#if (eq x y)}}`, `{{toLowerCase x}}`, `{{#each xs}}`, `{{#unless @last}}`, `{{~`) is **not** Mustache. Mustache engines will not parse it. Do not advertise “we use Mustache” for the Template tab; do use Mustache-level snippets in table cells.
- Highlighter restriction is **not** sufficient. Implement lint as parse + helper/path classification (`Handlebars.parse` + walk), surfaced through `@codemirror/lint`. The existing StreamLanguage can keep colouring.
- Lung-MDT PROD/QA templates stay loadable (they are already VMS-Hbs). Decision-table work still wants to *reauthor* nested `#if` into tables; that is UX/verification surface, not a dialect violation.
- Go `text/template` in `text_code` is unchanged (ADR 0004). JS/TS in `text_code` remain hatches.
- Blockly toolbox still offers `text_handlebars` / `text_code`; the linter, not removal, enforces the dialect ([#40](https://github.com/regionstockholm/intehrgrator/issues/40)).

**Considered:** (a) keep all Handlebars as an opaque hatch — rejected; the closed set is already what we ship. (b) Mustache-only in every editor — rejected; lung-MDT and Kintegrate `#if`/`eq`/`each` would not load. (c) Enforce only by shrinking the CodeMirror tokenizer — rejected; it cannot see helpers vs paths.
