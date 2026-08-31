# AI Mapping Suggestion Exchange Format

Link this doc in prompts; do not paraphrase. Machine-readable contract: [AI_SUGGESTION_FORMAT.schema.json](AI_SUGGESTION_FORMAT.schema.json) (JSON Schema 2020-12). **Import Suggestions** validates pasted JSON against that schema and can copy the errors back to the AI.

## Purpose

Copy-paste AI assist (no in-app API): app builds a prompt → user pastes into an external chat → AI returns one fenced JSON block → **Import Suggestions** applies it.

Canonical mapping structure is Blockly JSON. AI returns a **slot-keyed subset** (no skeleton RM containers, ids, or `x`/`y`).

## Response

One fence tagged `intehrgrator-suggestions`. Prose outside the fence is ignored.

````markdown
```intehrgrator-suggestions
{
  "format": "intehrgrator-suggestions",
  "version": "2",
  "target": { "format": "openehr-template", "targetId": "vitals_encounter_v1" },
  "loops": [ … ],
  "suggestions": [ … ]
}
```
````

```json
{
  "format": "intehrgrator-suggestions",
  "version": "2",
  "target": {
    "format": "openehr-template | json-schema | xml-schema | free-form",
    "targetId": "string — must match loaded target id"
  },
  "loops": [
    {
      "attachSlotId": "string — repeatable container from manifest (multiplicity 0..* / 1..*)",
      "block": {
        "type": "for_each_source",
        "fields": { "VAR": "vital", "PATH": "$.vitals" }
      },
      "note": "optional"
    }
  ],
  "suggestions": [
    {
      "slotId": "string — copy from manifest",
      "loopVar": "vital",
      "block": {
        "type": "source_query_number",
        "fields": { "EXPRESSION": "systolic" }
      },
      "note": "optional"
    }
  ]
}
```

- `target.targetId` ≡ Mapping Model `templateId`. Mismatch → reject.
- Copy every `slotId` / `attachSlotId` **verbatim** from the prompt manifest.
- `loops` optional. Omit when all mappings are single-valued.
- `loopVar` optional on a suggestion; when set, must equal some `loops[].block.fields.VAR`. `EXPRESSION` is then **relative to that loop’s `PATH`** (no leading `$` / `/`). Absolute `EXPRESSION` ignores `loopVar`.

### `slotId` shapes (read-only; do not invent)

| Target | Pattern |
|--------|---------|
| `openehr-template` | `{targetId}{path}` — leaves often end `/value` |
| `json-schema` | `{targetId}:{jsonPath}` |
| `xml-schema` | `{nameOrPath}:{xmlPath}` |
| `free-form` | as in manifest |

Unknown ids → skip on import.

### `block` subset

Blockly JSON (`type`, `fields`, `inputs`, `extraState` only). No `id`/`x`/`y`/`shadow`. App assigns ids and wraps openEHR `DV_*` shells.

**Allowed `type` (v2)**

| Family | Types | Fields / inputs |
|--------|-------|-----------------|
| Source | `source_query`, `source_query_number`, `source_query_boolean` | `EXPRESSION` (fontoxpath). Pick by `valueType`: number→`_number`, boolean→`_boolean`, else plain. |
| Loop | `for_each_source` | `VAR`, `PATH` (absolute multi-node path). Statement block — **only** in `loops[]`, not as a value `suggestions[].block`. Leave `DO` empty. |
| Var | `variables_get` | `VAR` = loop variable name (whole node as value; rare). |
| Map lookup | `maps_get` | `NAME` = map name; input `KEY` = key expression (literal `text` or dynamic `source_query`). |
| Map literal | `maps_create_with`, `maps_create_empty` | Inline key/value table: `KEY0`… + `VAL0`… inputs; `extraState.itemCount`. Emits `map("k1", v1, …)`. |
| Literal | `text`, `math_number`, `logic_boolean` | `TEXT` / `NUM` / `BOOL` (`TRUE`\|`FALSE`) |
| Text | `text_trim`, `text_join` | `MODE`; `text_join` may need `extraState.itemCount` + `ADD0`… |
| Math | `math_arithmetic` | `OP`: `ADD`\|`MINUS`\|`MULTIPLY`\|`DIVIDE`; inputs `A`,`B` |
| Logic | `logic_ternary` | inputs `IF`,`THEN`,`ELSE` |

No JS wrappers (`xpathNumber("…")`). No RM containers, `DV_*` shells, Optional RM, Handlebars text, or list-construction blocks (`lists_*`) in this envelope — list-valued RM slots stay structural on the canvas.

**Maps vs lists:** Use `maps_get` / `maps_create_with` for code translations, terminology tables, and lookups. List blocks are for authoring RM list structure on the canvas, not for AI-filled value expressions.

### Loops (source ↔ target repetition)

Use when source has repeating nodes (e.g. several vitals in one encounter) and the target slot’s `multiplicity` is `0..*` / `1..*` (or a child of such a container).

1. Add one `loops[]` entry: `attachSlotId` = repeatable container; `PATH` = absolute fontoxpath selecting those nodes; `VAR` = short name.
2. Map child value slots with `loopVar` = that `VAR` and **relative** `EXPRESSION` (child step(s) only).
3. One source loop ↔ one repeating target container. Do not unroll `[1]`,`[2]`,… unless the user asked for a single instance.

**Path dialects** (`PATH` / absolute `EXPRESSION`): JSON/`$…` · XML `/…` · FLAT bracket keys as in the source tree. Relative `EXPRESSION` stays relative to the loop node (e.g. `pulse`, not `$.measurements[*].pulse`).

## Prompt / input

**Copy AI Prompt** clipboard markdown:

1. Task (source → loaded **Target instance format**)
2. Target / source schema / examples (format, filename, origin)
3. Scope `full` \| `slot`
4. Link to this doc
5. Slot manifest: `{ slotId, valueType, label, targetPath?, multiplicity? }` — `valueType` is format-native (openEHR `DV_*`, JSON Schema `string`/`number`, XSD type, …)
6. Artifact delivery (below)
7. Instruction: one version-`2` fence; use `loops` + relative paths when `multiplicity` is repeating (repeatable containers are listed separately for `attachSlotId`). Prefer **`maps_get` / `maps_create_with`** for terminology and code translation (e.g. ICD-10 → SNOMED CT) — more common than bare defaults. Target scaffold generation often wires Defaults Map lookups (`maps_get` with `"defaults"`) before Copy AI Prompt — **omit those slots only when the source has no value** and the user did not ask otherwise. **When the source has data for a slot that scaffold/defaults would fill, map from the source** (`source_query` / `text`); source wins over defaults. Typical examples: **context start time**, **healthcare facility**, **composer** (name/id). Party identity value slots map via `source_query` / `text` on the manifest leaf, not RM container blocks. Do not map source quantities onto ordinal/score fields unless the source is already that score.

### Artifact delivery

| Mode | Behavior |
|------|----------|
| `attach` | Checklist; user uploads in chat. URIs are context only. |
| `inline` | Embed bodies as multipart (`--intehrgrator-part`). |
| `uri` | Instruct AI to fetch each `originUrl`; local-only → attach checklist. |

GitHub `.t.json` closures: `uri` → root URL; `inline` → each fileset file.

**Inline part headers:** `Content-Type`, `Content-Disposition: attachment; filename="…"`, `X-Intehrgrator-Role` (`target`\|`source-schema`\|`example`\|`target-fileset`), optional `X-Intehrgrator-Origin`. Raw text body; close with `--intehrgrator-part--`.

## Import

**Import Suggestions** opens a paste dialog (clipboard is pre-filled only when the text looks like a suggestion envelope, not a Copy AI Prompt). The pasted JSON is validated against [AI_SUGGESTION_FORMAT.schema.json](AI_SUGGESTION_FORMAT.schema.json). Schema and apply errors stay in that dialog; **Copy errors for AI** puts a follow-up prompt on the clipboard.

1. Extract fence (or raw JSON). `format` and `target` may be omitted; the loaded target is used.
2. Require `version` `"2"`; match `target` when present
3. Nested `attachSlotId` / `for_each_source` groups inside `suggestions[]` are flattened into `loops[]`. Validate `for_each_source`; keep `loopVar` + relative `EXPRESSION` as-is; wrap the repeating container with `for_each_source` on the canvas
4. Apply each valid suggestion `block` → value slot; skip invalid entries; report applied / skipped / errors
5. User **Test Run**

## Examples

**Single values**

```intehrgrator-suggestions
{
  "format": "intehrgrator-suggestions",
  "version": "2",
  "target": { "format": "json-schema", "targetId": "PatientSchema" },
  "suggestions": [
    {
      "slotId": "PatientSchema:$.patient.familyName",
      "block": {
        "type": "text_trim",
        "fields": { "MODE": "BOTH" },
        "inputs": {
          "TEXT": {
            "block": {
              "type": "source_query",
              "fields": { "EXPRESSION": "$.name.family", "RETURN_TYPE": "string" }
            }
          }
        }
      }
    }
  ]
}
```

**Terminology translation (ICD-10 → SNOMED CT)**

User prompt: *“Map diagnosis ICD-10 codes to SNOMED CT using a lookup table.”*  
Assume a named map `icd10_snomed` on the canvas (or describe keys in `note`). Lookup with dynamic key from source:

```intehrgrator-suggestions
{
  "format": "intehrgrator-suggestions",
  "version": "2",
  "target": { "format": "openehr-template", "targetId": "problem_list_v1" },
  "suggestions": [
    {
      "slotId": "problem_list_v1/content/data/items/at0002/value/value/defining_code/code_string/value",
      "block": {
        "type": "maps_get",
        "fields": { "NAME": "icd10_snomed" },
        "inputs": {
          "KEY": {
            "block": {
              "type": "source_query",
              "fields": { "EXPRESSION": "$.diagnosis.icd10" }
            }
          }
        }
      },
      "note": "Map icd10_snomed: I10→38341003, E11→44054006, … (user may load table on canvas)"
    }
  ]
}
```

For a **small inline table** without a named map, nest `maps_create_with` inside `logic_ternary` branches (one branch per known code).

**Source over defaults (composer, time, facility)** — scaffold may already use `maps_get("defaults", …)`; when the source has values, map from source:

```intehrgrator-suggestions
{
  "format": "intehrgrator-suggestions",
  "version": "2",
  "target": { "format": "openehr-template", "targetId": "vitals_encounter_v1" },
  "suggestions": [
    {
      "slotId": "vitals_encounter_v1/context/start_time/value",
      "block": {
        "type": "source_query",
        "fields": { "EXPRESSION": "$.encounter.startTime" }
      }
    },
    {
      "slotId": "vitals_encounter_v1/composer/name/value",
      "block": {
        "type": "source_query",
        "fields": { "EXPRESSION": "$.author.displayName" }
      }
    }
  ]
}
```

**Defaults lookup (language)** — scaffold fallback only when source has no value and user did not override:

```intehrgrator-suggestions
{
  "format": "intehrgrator-suggestions",
  "version": "2",
  "target": { "format": "openehr-template", "targetId": "vitals_encounter_v1" },
  "suggestions": [
    {
      "slotId": "vitals_encounter_v1/language/value",
      "block": {
        "type": "maps_get",
        "fields": { "NAME": "defaults" },
        "inputs": {
          "KEY": { "block": { "type": "text", "fields": { "TEXT": "language" } } }
        }
      },
      "note": "Only when source has no language and user did not specify otherwise"
    }
  ]
}
```

**Repeating vitals → repeating target**

```intehrgrator-suggestions
{
  "format": "intehrgrator-suggestions",
  "version": "2",
  "target": { "format": "openehr-template", "targetId": "vitals_encounter_v1" },
  "loops": [
    {
      "attachSlotId": "vitals_encounter_v1/content/data/events",
      "block": {
        "type": "for_each_source",
        "fields": { "VAR": "vital", "PATH": "$.vitals" }
      }
    }
  ],
  "suggestions": [
    {
      "slotId": "vitals_encounter_v1/content/data/events/data/items/at0004/value/value/value",
      "loopVar": "vital",
      "block": {
        "type": "source_query_number",
        "fields": { "EXPRESSION": "systolic" }
      }
    },
    {
      "slotId": "vitals_encounter_v1/content/data/events/data/items/at0005/value/value/value",
      "loopVar": "vital",
      "block": {
        "type": "source_query_number",
        "fields": { "EXPRESSION": "diastolic" }
      }
    }
  ]
}
```

## Related

[MAPPING_SPECIFICATION.md](MAPPING_SPECIFICATION.md) · [BLOCKLY_INTEGRATION.md](BLOCKLY_INTEGRATION.md) · [SOURCE_QUERY.md](SOURCE_QUERY.md) · [UI_ARCHITECTURE.md](UI_ARCHITECTURE.md) · [future/integrated-ai-assist.md](future/integrated-ai-assist.md) · [AI_SUGGESTION_FORMAT.schema.json](AI_SUGGESTION_FORMAT.schema.json)
