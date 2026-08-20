# AI Mapping Suggestion Exchange Format

Link this doc in prompts; do not paraphrase. **Version `2` only.**

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
| Literal | `text`, `math_number`, `logic_boolean` | `TEXT` / `NUM` / `BOOL` (`TRUE`\|`FALSE`) |
| Text | `text_trim`, `text_join` | `MODE`; `text_join` may need `extraState.itemCount` + `ADD0`… |
| Math | `math_arithmetic` | `OP`: `ADD`\|`MINUS`\|`MULTIPLY`\|`DIVIDE`; inputs `A`,`B` |
| Logic | `logic_ternary` | inputs `IF`,`THEN`,`ELSE` |

No JS wrappers (`xpathNumber("…")`). No RM containers, `DV_*` shells, Optional RM, or Handlebars text in this envelope.

### Loops (source ↔ target repetition)

Use when source has repeating nodes (e.g. several vitals in one encounter) and the target slot’s `multiplicity` is `0..*` / `1..*` (or a child of such a container).

1. Add one `loops[]` entry: `attachSlotId` = repeatable container; `PATH` = absolute fontoxpath selecting those nodes; `VAR` = short name.
2. Map child value slots with `loopVar` = that `VAR` and **relative** `EXPRESSION` (child step(s) only).
3. One source loop ↔ one repeating target container. Do not unroll `[1]`,`[2]`,… unless the user asked for a single instance.

**Path dialects** (`PATH` / absolute `EXPRESSION`): JSON/`$…` · XML `/…` · FLAT bracket keys as in the source tree.

## Prompt / input

**Copy AI Prompt** clipboard markdown:

1. Task (source → loaded **Target instance format**)
2. Target / source schema / examples (format, filename, origin)
3. Scope `full` \| `slot`
4. Link to this doc
5. Slot manifest: `{ slotId, valueType, label, targetPath?, multiplicity? }` — `valueType` is format-native (openEHR `DV_*`, JSON Schema `string`/`number`, XSD type, …)
6. Artifact delivery (below)
7. Instruction: one version-`2` fence; use `loops` + relative paths when `multiplicity` is repeating

### Artifact delivery

| Mode | Behavior |
|------|----------|
| `attach` | Checklist; user uploads in chat. URIs are context only. |
| `inline` | Embed bodies as multipart (`--intehrgrator-part`). |
| `uri` | Instruct AI to fetch each `originUrl`; local-only → attach checklist. |

GitHub `.t.json` closures: `uri` → root URL; `inline` → each fileset file.

**Inline part headers:** `Content-Type`, `Content-Disposition: attachment; filename="…"`, `X-Intehrgrator-Role` (`target`\|`source-schema`\|`example`\|`target-fileset`), optional `X-Intehrgrator-Origin`. Raw text body; close with `--intehrgrator-part--`.

## Import

1. Extract fence (or raw JSON)
2. Require `format` + `version` `"2"`; match `target`
3. Validate `loops[]` (`for_each_source` only); join `loopVar` + relative `EXPRESSION` onto that loop’s `PATH` when applying value slots
4. Apply each suggestion `block` → value slot; report applied / skipped / errors
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

[MAPPING_SPECIFICATION.md](MAPPING_SPECIFICATION.md) · [BLOCKLY_INTEGRATION.md](BLOCKLY_INTEGRATION.md) · [SOURCE_QUERY.md](SOURCE_QUERY.md) · [UI_ARCHITECTURE.md](UI_ARCHITECTURE.md) · [future/integrated-ai-assist.md](future/integrated-ai-assist.md)
