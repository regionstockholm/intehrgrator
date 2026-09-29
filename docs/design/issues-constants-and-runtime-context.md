# Planned GitHub Issues: Constants vs. Runtime Context Redesign

These issues implement the architecture described in [constants-and-runtime-context-redesign.md](constants-and-runtime-context-redesign.md).

Run these commands using the GitHub CLI (`gh`), or paste them into GitHub's new issue form:

---

## Issue 1: Codegen: separate script constants from dynamic runtime context variables

```bash
gh issue create \
  --title "Codegen: separate script constants from dynamic runtime context variables" \
  --label "ready-for-agent" \
  --body "Part of the Variables & Constants redesign specified in [docs/design/constants-and-runtime-context-redesign.md](docs/design/constants-and-runtime-context-redesign.md).

## Problem
Currently, all defaults in \`default_context_map\` are emitted as runtime map lookups (\`defaults[\"...\"\` in TypeScript, \`defaults.get(\"...\"\` in Java). Fixed constants (e.g. language \`\"sv\"\`, territory \`\"SE\"\`, encoding \`\"UTF-8\"\`) should use native constant mechanisms instead of hash map lookups. Real dynamic runtime context (e.g. \`composer\`, \`facility\`, \`time\`) should be passed in an incoming context hash map with clear documentation.

## Scope & Acceptance Criteria
1. **TypeScript Codegen**:
   - Emit declared constants as module-level \`const CONSTANT_NAME = ...;\`.
   - Rename/clarify parameter from \`defaults\` to \`context: Record<string, unknown> = {}\`.
   - Access dynamic variables directly via \`context[\"key\"]\`.
   - Generate caller integration documentation header with parameter types and code example.
2. **Java Codegen**:
   - Emit declared constants as \`private static final ... CONSTANT_NAME = ...;\`.
   - Clarify \`convert(Object source, Map<String, Object> context)\` signature and document it in the class header.
   - Access dynamic variables via \`context.get(\"key\")\`.
3. **Go Template & XQuery Codegen**:
   - Emit top-level template/module constants for script constants.
   - Access dynamic variables from pipeline context.
4. **Test Runner**:
   - Ensure \`runGeneratedTypeScript\` passes test values for dynamic context variables.
5. **Tests**:
   - Unit tests in \`test/codegen_test.ts\` verifying constant declarations and context variable lookups across all supported languages."
```

---

## Issue 2: UI: replace opaque scaffold target chips with editable text fields for wildcards

```bash
gh issue create \
  --title "UI: replace opaque scaffold target chips with editable text fields for wildcards" \
  --label "ready-for-agent" \
  --body "Part of the Variables & Constants redesign specified in [docs/design/constants-and-runtime-context-redesign.md](docs/design/constants-and-runtime-context-redesign.md).

## Problem
The current chip widget (\`FieldScaffoldTargets\`) rendered inside SVG \`foreignObject\` is opaque to users. Clicking a chip toggles between \`*.attr\` and \`Class.attr\` without keyboard editing, making custom wildcards (e.g. \`OBSERVATION.*.time\`) difficult or impossible to author directly.

## Scope & Acceptance Criteria
1. **Editable Text Field**:
   - Replace or enhance the chip widget with an explicit \`FieldTextInput\` for scaffold targets.
   - Allow direct typing of wildcards (e.g. \`*.language\`, \`COMPOSITION.composer\`, or comma-separated targets).
2. **Target Schema Drag & Drop**:
   - Retain drag-and-drop from the Target Schema tree into the text field to automatically insert or append the target path.
3. **Syntax Helper / Quick Toggle**:
   - Provide a quick toggle action or helper tooltip explaining wildcard syntax (\`*.attribute\` vs \`Class.attribute\`).
4. **Differentiate Constants vs Context Variables**:
   - Support distinct fields for Constants (fixed value) vs Context Variables (name + test value).
5. **Tests**:
   - Unit tests for target path parsing, wildcard matching, and serialization.
   - UI interaction tests for typing and editing target paths."
```

---

## Issue 3: Blockly & Scaffolding: add \"Variables & Constants\" toolbox category and re-apply scaffold action

```bash
gh issue create \
  --title "Blockly & Scaffolding: add \"Variables & Constants\" toolbox category and re-apply scaffold action" \
  --label "ready-for-agent" \
  --body "Part of the Variables & Constants redesign specified in [docs/design/constants-and-runtime-context-redesign.md](docs/design/constants-and-runtime-context-redesign.md).

## Problem
The floating \`default_context_map\` block on the canvas is visually disconnected from the rest of the Blockly workflow. Users expect to find Variables and Constants in the toolbox. Furthermore, when changing or adding constants, context variables, or scaffold target patterns, users need an easy way to apply the patterns to the existing scaffold without overwriting mappings authored from the source.

## Scope & Acceptance Criteria
1. **Toolbox Category: \"Variables & Constants\"**:
   - Introduce a dedicated \"Variables & Constants\" category in \`src/blockly/toolbox_demo.ts\`, positioned directly adjacent to \"Source\".
   - Include getter blocks (\`constant_get\`, \`context_var_get\`) and definition blocks.
2. **Re-apply Scaffolding Action**:
   - Provide an \"Apply to Scaffold\" action on definition blocks and in the Target & Previews toolbar.
   - **Source-over-defaults rule**: Never overwrite target slots already mapped from \`source_query\` or custom expression logic.
   - Wire unmapped (shadow) slots or existing default lookups to the most specific matching constant or context variable.
   - Provide feedback toast indicating how many slots were wired and how many source-mapped slots were preserved.
3. **Clean Cutover & Retirement of Defaults Block**:
   - Convert all in-repo Example Sets and fixtures; retire the legacy \`default_context_map\` block (no runtime dual-read).
   - Generic \`maps_create_with\` / \`maps_get\` remain untouched in \"Lists & maps\" for standard maps.
   - Update documentation (\`CONTEXT.md\`, \`docs/TUTORIAL.md\`).
4. **Tests**:
   - UI green-path test demonstrating adding a constant/context variable and applying it to an openEHR template skeleton.
   - Regression test ensuring source queries are preserved upon re-applying scaffold."
```
