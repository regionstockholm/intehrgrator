# intEHRgrator

Visual integration workbench for mapping source data (JSON/XML) to openEHR Compositions via Blockly + CodeMirror.

## Webapp for users
Go to https://regionstockholm.github.io/intehrgrator/ click (i) - encircled i - at various places in the interface to learn about use.

## Desktop app (0.5)

Download a platform build from [Releases](https://github.com/regionstockholm/intehrgrator/releases) and run it locally — no Deno install, no GitHub Pages. The same workbench opens in a native window (OS webview) and talks only to `127.0.0.1`.

**New in 0.5:** **Sheets** in Mapping Editors (jspreadsheet-ce widget, CSV import/export, `sheet_*` Blockly accessors, convert-time `ctx.sheets` bag). Lists and Maps share one toolbox drawer (**Lists & maps**); `maps_*` stay for Defaults Map and nested Blockly values. See [docs/ROADMAP.md](docs/ROADMAP.md) §C and [tasks/DESIGN-sheets-vs-maps.md](tasks/DESIGN-sheets-vs-maps.md).

**From 0.3:** localhost **Agent API** and stdio **MCP** server for IDE/AI agents, plus an installable mapping skill. See [docs/AGENT_WORKFLOW.md](docs/AGENT_WORKFLOW.md) and [.cursor/skills/intehrgrator-mapping/SKILL.md](.cursor/skills/intehrgrator-mapping/SKILL.md).

| Asset | Platform |
| --- | --- |
| `intEHRgrator-windows-x64.zip` | Windows x64 (WebView2) |
| `intEHRgrator-linux-x64.AppImage` | Linux x64 |
| `intEHRgrator-macos-x64.zip` | macOS Intel |
| `intEHRgrator-macos-arm64.zip` | macOS Apple Silicon |

On Windows, unzip and run `intEHRgrator.exe` **next to** `intEHRgrator.dll` (do not copy the exe alone). On Linux, `chmod +x` the AppImage.

Rebuild from source:

```bash
deno task compile:desktop   # Windows / Linux AppImage / macOS .app → dist/release/
deno task desktop           # build + run in a native window (needs Deno 2.9+)
```

## Quick start for developers

```bash
deno task vendor   # clone/update ehrtslib + examples from origin/main into vendor/
deno task test     # unit tests (no browser)
deno task test:ui  # Playwright: Click-to-Map + Test Run (see docs/UI_TESTING.md)
deno task build    # outputs static site to dist/
deno task dev      # serve dist/ on http://localhost:5173
```

### GitHub Pages

The Web Shell is published on every push to `main` via the **Deploy GitHub Pages** workflow (also runnable manually from Actions). Ensure **Settings → Pages → Build and deployment → Source** is **GitHub Actions**.

CI (`vendor` → test → build) always checks out **ehrtslib `origin/main`**, so upstream module moves fail tests instead of shipping against a stale pin.

Open `dist/index.html` (or use `deno task dev`) to use the Web Shell locally.

## Implementation layout

| Path | Role |
|------|------|
| `src/core/` | OPT skeleton, Mapping Model, spec, source query, codegen, persistence, AI |
| `src/blockly/` | openEHR Blockly blocks + generators |
| `src/workbench/` | UI controller, tree views, CodeMirror setup |
| `src/host/` | `HostAdapter` + browser implementation |
| `src/desktop/` | `deno desktop` entry: local HTTP + native window |
| `web/` | HTML/CSS entry; bundled to `dist/bundle.js` |
| `test/` | Deno unit tests + OPT fixtures |
| `test/ui/` | Playwright UI tests (Workbench Test API) |
| `src/ui_test/` | Workbench Test API types / helpers |

## Documentation

| | |
|---|---|
| **Glossary** | [CONTEXT.md](CONTEXT.md) |
| **Project prompt** | [INITIAL_PROMPT.md](INITIAL_PROMPT.md) |
| **PRD (v1)** | [tasks/PRD-intehrgrator-v1.md](tasks/PRD-intehrgrator-v1.md) · [tasks/TASKS-intehrgrator-v1.md](tasks/TASKS-intehrgrator-v1.md) |
| **UI design** | [docs/UI_ARCHITECTURE.md](docs/UI_ARCHITECTURE.md) · [mockup](docs/assets/prototype-ui-v1-consolidated.png) |
| **UI testing** | [docs/UI_TESTING.md](docs/UI_TESTING.md) |
| **Blockly** | [docs/BLOCKLY_INTEGRATION.md](docs/BLOCKLY_INTEGRATION.md) |
| **Mapping spec** | [docs/MAPPING_SPECIFICATION.md](docs/MAPPING_SPECIFICATION.md) |
| **Source data** | [docs/SOURCE_FORMATS.md](docs/SOURCE_FORMATS.md) · [docs/SOURCE_QUERY.md](docs/SOURCE_QUERY.md) |
| **Persistence** | [docs/PROJECT_PERSISTENCE.md](docs/PROJECT_PERSISTENCE.md) |
| **AI assist** | [docs/AI_SUGGESTION_FORMAT.md](docs/AI_SUGGESTION_FORMAT.md) |
| **Agent / MCP** | [docs/AGENT_WORKFLOW.md](docs/AGENT_WORKFLOW.md) · [.cursor/skills/intehrgrator-mapping/SKILL.md](.cursor/skills/intehrgrator-mapping/SKILL.md) |
| **Deferred** | [docs/future/](docs/future/) |
| **Agents** | [AGENTS.md](AGENTS.md) |

**RM Blockly coverage:** Party identity slots on `PARTY_IDENTIFIED` / `PARTY_RELATED` include `name`, `identifiers` (`List<DV_IDENTIFIER>` via `dv_identifier` / `lists_create_with`), and `external_ref` (`PARTY_REF` shell). Full Demographics product scope (e.g. standalone demographic compositions, `PARTY` records beyond these RM shells) is **not yet implemented**.

> [old-clippings.md](old-clippings.md) is superseded by INITIAL_PROMPT.md and the docs above.

## Libraries

- [ErikSundvall/ehrtslib](https://github.com/ErikSundvall/ehrtslib) — openEHR TypeScript (RM, Test Run)
- [Ehrlibs/openEHR-model-examples](https://github.com/Ehrlibs/openEHR-model-examples) — demo archetypes/templates (`deno task vendor` → `vendor/openEHR-model-examples/`)
- [openEHR/archie](https://github.com/openEHR/archie) — openEHR Java (export target)
- [FontoXML/fontoxpath](https://github.com/FontoXML/fontoxpath) — XPath 3.1 queries on JSON/XML sources
- [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) — openEHR RM XML (aligned with ehrtslib)

DeepWiki indexes for ehrtslib, archie, and openEHR specs — see [AGENTS.md](AGENTS.md).
