---
name: intehrgrator-mapping
description: Guide AI agents mapping source data to openEHR (or other targets) via intEHRgrator desktop Agent API or MCP. Use when editing .intehrgrator projects, producing intehrgrator-suggestions JSON, or driving mappings from an IDE.
---

# intEHRgrator mapping agent

## When to use

- User has **intEHRgrator desktop** open with a loaded target + source example
- Task is **mapping** source fields to target slots (including **loops**, terminology maps, party identity)
- Output must validate against **`intehrgrator-suggestions`** version 2

## Golden path

1. MCP **`register_agent`** (or `POST /api/v1/register-agent`) — note returned **agentId**, **displayName**, **color**
2. Confirm desktop Agent API: `GET http://127.0.0.1:<port>/api/v1/snapshot`
3. Read revision from snapshot; pass **`If-Match`** / `revision` on mutations; include agent headers on writes
4. `POST /api/v1/build-prompt` or MCP `build_prompt` → paste into LLM **or** generate suggestions yourself
5. `POST /api/v1/import-suggestions` or MCP `import_suggestions` with fenced JSON
6. `POST /api/v1/run-test` — verify `testOk`
7. Use **`undo`** (scope `agent` / `user` / `global`) or **`get_history`** + **`restore_at`** if the user rejects a change

Full HTTP table: [docs/AGENT_WORKFLOW.md](../docs/AGENT_WORKFLOW.md)

## Multi-agent etiquette

- Register once per MCP session; mutations are attributed in **joint history**
- User watches via **Open observer** (timeline + agent legend) — do not assume main canvas auto-scrolls
- For partial revert of one history row, use **`build_patch_prompt`** → LLM → **`import_suggestions`** (strict v2 JSON only)

## Suggestion rules (do not paraphrase)

Read [docs/AI_SUGGESTION_FORMAT.md](../docs/AI_SUGGESTION_FORMAT.md).

- Value slots only — no RM container blocks in the envelope
- **`loops[]`** + relative `EXPRESSION` for repeating containers
- **`maps_get` / `maps_create_with`** for terminology (ICD-10 → SNOMED) — more important than defaults
- **Source over defaults**: if source has time, facility, composer, etc., map from source; scaffold defaults are often pre-wired — omit unless user overrides
- Copy `slotId` / `attachSlotId` verbatim from the prompt manifest

## openEHR help

- Prefer **openehr-assistant MCP** when available ([openEHR Assistant Plugin](https://github.com/cadasto/openehr-assistant-plugin))
- [specifications.openehr.org/llms.txt](https://specifications.openehr.org/llms.txt)
- [DeepWiki ehrtslib](https://deepwiki.com/ErikSundvall/ehrtslib)

## Fallback (no API)

Export mapping spec or generated TypeScript from the UI — **read-only** context; user applies changes manually via Import AI suggestions.
