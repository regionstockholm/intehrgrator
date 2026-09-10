# intEHRgrator tutorial

A short tour of the workbench. Terms in **bold** match the [glossary](../CONTEXT.md). Click the encircled **i** in the UI for format notes; use **Help** in the toolbar for this tutorial and to report a problem or request a feature.

## 1. Open a copy

| Copy | When to use it |
| --- | --- |
| [Latest web build](https://regionstockholm.github.io/intehrgrator/) | Trying new work. This URL always tracks `main` and is **not** guaranteed stable. |
| Frozen web URL (`…/intehrgrator/v…/`) | Training, demos, or a mapping you must reopen later. Listed in [versions.json](https://regionstockholm.github.io/intehrgrator/versions.json). |
| [Desktop release](https://github.com/regionstockholm/intehrgrator/releases) | Local files only (`127.0.0.1`). Needed for the Agent API / MCP appendix. |

The footer shows the build (`v… · git · timestamp`). **Help** copies that plus this session’s address.

## 2. Three panes

```
Source                  Mapping Editors              Target & Previews
schema + examples       Blockly + Spec/Sheets/Hbs    generated script + Test Run
```

- **Source Pane** — **Source Schema** on top, **Example Instance** tabs below. Mapping can start from schema alone; **Test Run** needs an example tab.
- **Mapping Editor** — Blockly canvas (template/schema skeleton) above; **Mapping Specification**, **Sheets**, and **Handlebars Template** tabs below.
- **Target & Previews** — load the **Target instance format**, then **Generated conversion script(s)** and **Conversion Test Run(s)**.

Drag the splitters. Layout is remembered in this browser.

## 3. Fastest start: Example Sets

Toolbar **Example Sets** (▾ for the catalog). A set can load a schema, examples, a target, and sometimes a mapping plus a **Defaults Map**. The workspace is replaced — export first if you care about the current project.

Try a small JSON→JSON set before a clinical OPT.

## 4. Load your own files

| You have | Where |
| --- | --- |
| Source structure (JSON Schema, XML/XSD, openEHR Web Template, …) | Source → **Load Schema** (file, URL, or GitHub template) |
| One or more real records | Source → **+ Add Example** (file, folder, URL, GitHub folder) |
| Target (OPT/OPT2, Web Template, JSON Schema, XSD, ADL, free-form) | Target & Previews → **Open** |

GitHub file pages are accepted; the app fetches raw content (and sibling archetypes for `.t.json`).

**New Project** clears the workspace. **Save as** / **Load Project** use this browser’s IndexedDB. **Export Project** / **Import Project** use a portable `.intehrgrator` **Project Bundle** (shareable; does not include Test Run output — that is rebuilt on load).

## 5. Map a field (Click-to-Map)

1. Open a target so the **Template Skeleton** appears. A **Conversion start** hat snaps onto the **Instance root** (the tree that is the product). Leave it there unless you intentionally designate a different root (JSON object, XML element, or **Text document**).
2. Click an empty value slot on a Blockly block — or select a **Source query block** still showing the placeholder `/path`. That enters **Listening Mode**.
3. Click the matching node in the schema tree or the **Active Example** tree. A **Source Path** (fontoxpath) is written into the slot.

You can also **drag** a source node onto a value slot. Yellow **Constraint warning** triangles mark unmapped mandatory slots and broken cardinalities; click a **Mapping Spec** row to pan to the same block.

Repeating source nodes: Click-to-Map under a repeating container wraps it in **`for_each_source`**. Prefer that over hand-built loops.

## 6. Defaults, optional RM, and lookups

- **Defaults block** (already on the canvas) holds a **Defaults Map** (`language`, `territory`, `composer_name`, `time`, facility, …). Folder control on the block: pick, save as, download. Scaffolding **joins** lookups into default points rather than replacing this block. Generated scripts still take the map as a convert-time argument.
- **Cogwheel** on an RM block: **Optional RM Insertion**. Add `feeder_audit` and similar RM-optional attributes; removing one leaves the child on the canvas (not deleted). Template-mandatory mouths stay on the block. A **Δ** **Constraint Overlay** on a mouth means the template narrowed the RM interval.
- **Lists & maps** drawer: 1D **Map** / **Map lookup**. **Sheets** drawer: read-only accessors into the **Sheets** tab (2D grid, CSV/paste). **Decision table** sheets (`kind: decision-table`) sit next to ordinary sheets — condition columns plus value or snippet outputs.

Right-click a defaults lookup when you want that key **hardcoded** as a literal instead of a convert-time lookup.

## 7. Test, then export a script

**Output mode** (Target & Previews header):

- **Mapping preview** — interprets the mapping against the Active Example (no script yet).
- **TypeScript**, **Handlebars**, **Go Template** — generate a **Conversion Script** and can **Run Test** in the browser.
- **Java**, **XQuery** — generate a script; in-app execution is not there yet.

**Run Test** once, or **Autoplay** to re-run after edits (needs an example tab). Download the script from the generated-script editor; download the instance from Conversion Test Run. For an openEHR template target, ✅ / ⚠ is **Output validation** against the OPT — invalid output is still shown.

## 8. Other Mapping Editor tools

| Control | Role |
| --- | --- |
| Undo / Redo | Mapping Editor history |
| Expand / Collapse all | Nested Blockly |
| Open viewer window | Live canvas, agent legend, history timeline (desktop Agent API) |
| Follow agent | Opt-in pan to MCP/agent edits (off by default) |
| Mapping Spec | Compact projection; safe fields are editable. Download/Upload is still **full Blockly JSON** |
| Handlebars Template | Authored **VMS-Hbs** for free-form / Kintegrate-style targets. Source click inserts `{{path}}` |
| Functions drawer | **Extract to function** on a block’s context menu |

**Copy AI Prompt** (▾: embed files, attach in chat, or browse URIs) → paste into any chat. **Import AI suggestions** pastes `intehrgrator-suggestions` JSON back onto the canvas. Details: [AI_SUGGESTION_FORMAT.md](AI_SUGGESTION_FORMAT.md).

**UI language** (toolbar) is the workbench locale, not composition `language` and not **model language** (ontology labels on the target).

## 9. Tell us what broke — or what you need

**Help** → **Report a problem** or **Request a feature**. Both open GitHub Issues. Feature requests are welcome. Include the copied version string.

---

## Appendix A — Desktop Agent API and MCP

The GitHub Pages **Web Shell** has no Agent API. Use a **desktop** build (or `deno task desktop` from a clone).

1. Start desktop. Confirm `GET http://127.0.0.1:<port>/api/v1/health` returns JSON (`{"ok":true,…}`). **Help → Copy version** includes this session’s origin, which is the API host.
2. Leave the workbench open with a target and an example loaded. The UI polls `/api/v1/snapshot` and reloads when an agent writes.
3. Point an MCP client at this repo’s stdio server, with `INTEHR_AGENT_URL` set to that origin (no trailing `/api/v1`). Cursor example (project `.cursor/mcp.json` or user MCP settings), run from a clone so `deno task mcp` resolves:

```json
{
  "mcpServers": {
    "intehrgrator": {
      "command": "deno",
      "args": ["task", "mcp"],
      "env": {
        "INTEHR_AGENT_URL": "http://127.0.0.1:8765"
      }
    }
  }
}
```

Replace `8765` with the port from step 1. Without `INTEHR_AGENT_URL`, MCP still starts but talks to a **headless** workbench (no live canvas). Disable the API entirely with `INTEHR_AGENT_API=0`.

Tools include `register_agent`, `get_snapshot`, `import_suggestions`, `map_slot`, `run_test`, `undo` / `redo`. Full table: [AGENT_WORKFLOW.md](AGENT_WORKFLOW.md). Watch edits in **Open viewer window**; enable **Follow agent** only if you want the main canvas to pan.

Optional companion: [openEHR Assistant](https://github.com/cadasto/openehr-assistant-plugin) MCP for archetype/template/spec lookup.

## Appendix B — Mapping skill in a local AI IDE

The skill [`.cursor/skills/intehrgrator-mapping`](https://github.com/regionstockholm/intehrgrator/tree/main/.cursor/skills/intehrgrator-mapping) tells the IDE agent how to drive mappings (`intehrgrator-suggestions` v2, Agent API etiquette, when to prefer source over defaults).

**In a clone of this repo:** Cursor (and other tools that read `.cursor/skills/` or `.agents/skills/`) already see it. Ask the agent to map slots with the desktop app open and MCP connected as in Appendix A.

**In another project:** copy that skill folder into the other repo’s `.cursor/skills/intehrgrator-mapping/`, or add the same files under `.agents/skills/`. Keep [AI_SUGGESTION_FORMAT.md](AI_SUGGESTION_FORMAT.md) reachable or paste the format rules into the skill — the skill links to it by relative path.

Web-only fallback (no MCP): **Copy AI Prompt** → chat → **Import AI suggestions**. That path does not live-update Blockly from the IDE.
