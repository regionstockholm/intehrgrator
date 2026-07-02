# intEHRgrator

Visual integration workbench for mapping source data (JSON/XML) to openEHR Compositions via Blockly + CodeMirror.

## Quick start

```bash
deno task vendor   # clone ehrtslib into vendor/ (first time)
deno task test
deno task build    # outputs static site to dist/
deno task dev      # serve dist/ on http://localhost:5173
```

### GitHub Pages (optional)

CI runs `deno task test` and `deno task build` on every push/PR.

To publish the Web Shell to GitHub Pages:

1. **Enable Pages:** repo **Settings → Pages → Build and deployment → Source: GitHub Actions**
2. Run the **Deploy GitHub Pages** workflow manually (`workflow_dispatch`), or uncomment the `push` trigger in `.github/workflows/pages.yml` for deploys on every `main` push.

Open `dist/index.html` (or use `deno task dev`) to use the Web Shell locally.

## Implementation layout

| Path | Role |
|------|------|
| `src/core/` | OPT skeleton, Mapping Model, spec, source query, codegen, persistence, AI |
| `src/blockly/` | openEHR Blockly blocks + generators |
| `src/workbench/` | UI controller, tree views, CodeMirror setup |
| `src/host/` | `HostAdapter` + browser implementation |
| `web/` | HTML/CSS entry; bundled to `dist/bundle.js` |
| `test/` | Deno unit tests + OPT fixtures |

## Documentation

| | |
|---|---|
| **Glossary** | [CONTEXT.md](CONTEXT.md) |
| **Project prompt** | [INITIAL_PROMPT.md](INITIAL_PROMPT.md) |
| **PRD (v1)** | [tasks/PRD-intehrgrator-v1.md](tasks/PRD-intehrgrator-v1.md) · [tasks/TASKS-intehrgrator-v1.md](tasks/TASKS-intehrgrator-v1.md) |
| **UI design** | [docs/UI_ARCHITECTURE.md](docs/UI_ARCHITECTURE.md) · [mockup](docs/assets/prototype-ui-v1-consolidated.png) |
| **Blockly** | [docs/BLOCKLY_INTEGRATION.md](docs/BLOCKLY_INTEGRATION.md) |
| **Mapping spec** | [docs/MAPPING_SPECIFICATION.md](docs/MAPPING_SPECIFICATION.md) |
| **Source data** | [docs/SOURCE_FORMATS.md](docs/SOURCE_FORMATS.md) · [docs/SOURCE_QUERY.md](docs/SOURCE_QUERY.md) |
| **Persistence** | [docs/PROJECT_PERSISTENCE.md](docs/PROJECT_PERSISTENCE.md) |
| **AI assist** | [docs/AI_SUGGESTION_FORMAT.md](docs/AI_SUGGESTION_FORMAT.md) |
| **Deferred** | [docs/future/](docs/future/) |
| **Agents** | [AGENTS.md](AGENTS.md) |

> [old-clippings.md](old-clippings.md) is superseded by INITIAL_PROMPT.md and the docs above.

## Libraries

- [ErikSundvall/ehrtslib](https://github.com/ErikSundvall/ehrtslib) — openEHR TypeScript (RM, Test Run)
- [openEHR/archie](https://github.com/openEHR/archie) — openEHR Java (export target)
- [FontoXML/fontoxpath](https://github.com/FontoXML/fontoxpath) — XPath 3.1 queries on JSON/XML sources
- [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) — openEHR RM XML (aligned with ehrtslib)

DeepWiki indexes for ehrtslib, archie, and openEHR specs — see [AGENTS.md](AGENTS.md).
