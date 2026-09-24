# intEHRgrator — Developer guide

Technical setup and architecture pointers for contributors and AI-assisted development.

For terms and definitions used in this repo, including in this readme, see [CONTEXT.md](CONTEXT.md).

**End-user docs:** [README.md](README.md) · [docs/TUTORIAL.md](docs/TUTORIAL.md)

## Prerequisites

- **[Deno](https://docs.deno.com/runtime/getting_started/installation/)** 2.9+ — the project runtime, task runner, test runner, and desktop packager. We use Deno instead of Node/npm for installs, linting, testing, and builds.
- **Go 1.22+** (optional) — only to rebuild the vendored Go `text/template` WASM (`deno task wasm:go-template`).
- **Playwright** (optional) — installed automatically by `deno task test:ui` for browser tests.

## How to run locally

install deno, and then:

```bash
git clone https://github.com/regionstockholm/intehrgrator.git
cd intehrgrator
deno task vendor   # clone/update latest ehrtslib + examples into vendor and apply local patches
deno task build  # build web shell into /dist
deno task dev`  # start and serve on `http://localhost:5173`
```

NOTE: `git pull` does not refresh or re-patch `vendor/ehrtslib`. Run `deno task vendor` after clone, and re-run after pulling `main` if openEHR validation tests fail oddly (or routinely after pull so your tree matches CI). The task resets ehrtslib to upstream `origin/main`, then re-applies local TemplateValidator patches (`scripts/patch-ehrtslib-validator.ts`).

## Tests

Strategy, seams, facets, and CI gates: **[docs/TESTING.md](docs/TESTING.md)**. Playwright harness: [docs/UI_TESTING.md](docs/UI_TESTING.md).

| Layer | Command | When it runs |
|-------|---------|----------------|
| Unit + Agent/MCP (`test/`, not `test/ui`) | `deno task test` | Locally; CI on every PR; Pages; release |
| UI / Playwright (`test/ui/`) | `deno task test:ui` | Locally; CI on every PR; release (must pass before publish) |
| Unit then UI | `deno task test:all` | Local convenience |
| Optional BaseX XQuery golden | `deno task test:xquery-engine` | When BaseX is on `PATH` (skips otherwise) |

The UI **green-path** (`test/ui/green_path_test.ts`) walks load → Click-to-Map → RM COMPOSITION / Defaults / Optional RM Insertion → Test Run → Generated Export. Add new Mapping Editor chrome as a focused `test/ui/` case; extend the green-path when the change is a major authoring step.

## Deno tasks

| Task | Purpose |
| ------ | --------- |
| `deno task vendor` | Refresh `vendor/ehrtslib` and example archetypes from upstream, then apply local TemplateValidator patches |
| `deno task build` | Static site → `dist/` (includes `examples/` + `test/fixtures/`) (+ desktop www staging) |
| `deno task dev` | Serve `dist/` on `http://localhost:5173` |
| `deno task test` | Unit + Agent tests (`test/`, parallel, no browser) |
| `deno task test:ui` | Playwright UI tests — see [docs/TESTING.md](docs/TESTING.md) and [docs/UI_TESTING.md](docs/UI_TESTING.md) |
| `deno task test:all` | `test` then `test:ui` |
| `deno task test:xquery-engine` | Optional BaseX golden (`test/xquery_engine_test.ts`) |
| `deno task lint` | `deno lint` on `src`, `test`, `scripts` |
| `deno task check` | Type-check TypeScript sources |
| `deno task desktop` | Build + run native window (`deno desktop`) |
| `deno task compile:desktop` | Platform binaries → `dist/release/` |
| `deno task mcp` | Stdio MCP server for IDE agents (proxies to `INTEHR_AGENT_URL` or embeds a headless `WorkbenchService`) |
| `deno task release -- --version X.Y.Z` | Bump, tag, push; CI publishes desktop + pinned Pages |
| `deno task release:no-test -- --version X.Y.Z` | Same as `release`, skip local unit tests (`--no-test`); CI still tests the tag |
| `deno task wasm:go-template` | Rebuild Go template WASM in `web/wasm/` |
| `deno task setup:better-forms` | Licensed Better Form renderer assets (not committed) |

### GitHub Pages

Every push to `main` deploys the bleeding-edge web shell. `deno task release` also publishes an immutable copy under `/vX.Y/` and updates [versions.json](https://regionstockholm.github.io/intehrgrator/versions.json).

`versions.json` also carries a `recommended` field naming the tag (e.g. `"v0.7.5"`) the Web Shell suggests end users stick to. It defaults to the newest published release tag on every deploy, but a still-published previous recommendation is preserved across deploys unless overridden. To pin an older release as recommended (e.g. while a new one is still shaking out), commit a `RECOMMENDED_VERSION` file at the repo root containing just the tag; `scripts/assemble-pages.ts` reads it (or the `RECOMMENDED_VERSION` env var) on the next Pages deploy. Visiting any non-recommended version of the deployed site (including the bleeding-edge root) shows a popup linking to the recommended version, the tutorial, and the README.

CI runs **`deno task vendor`** (ehrtslib `origin/main` + local patches), so upstream module changes fail tests instead of shipping stale pins.

## Repository layout

| Path | Role |
|------|------|
| `src/core/` | Mapping Model, codegen, persistence, AI prompt/import |
| `src/blockly/` | openEHR blocks, VMS profile, generators |
| `src/workbench/` | UI controller, trees, CodeMirror, mapping spec |
| `src/host/` | `HostAdapter` seam (web + VS Code webview) |
| `src/desktop/` | `deno desktop` entry, Agent API HTTP server |
| `src/agent/` | MCP stdio server |
| `web/` | HTML/CSS entry; bundled to `dist/bundle.js` |
| `test/` | Deno unit tests + fixtures |
| `test/ui/` | Playwright tests (Workbench Test API) |
| `docs/adr/` | Architecture Decision Records |
| `docs/design/` | Design investigations |
| `docs/planning/` | v1 implementation task list (archived chunks in `docs/historical-archive/`) |
| `docs/historical-archive/` | Superseded drafts |

## Architecture docs

| Topic | Document |
|-------|----------|
| **Glossary** (canonical terms) | [CONTEXT.md](CONTEXT.md) |
| **ADRs** (decisions) | [docs/adr/](docs/adr/) |
| UI layout & interactions | [docs/UI_ARCHITECTURE.md](docs/UI_ARCHITECTURE.md) |
| Blockly blocks & generators | [docs/BLOCKLY_INTEGRATION.md](docs/BLOCKLY_INTEGRATION.md) |
| Mapping spec & sync | [docs/MAPPING_SPECIFICATION.md](docs/MAPPING_SPECIFICATION.md) |
| Source formats & XPath | [docs/SOURCE_FORMATS.md](docs/SOURCE_FORMATS.md) · [docs/SOURCE_QUERY.md](docs/SOURCE_QUERY.md) |
| Project persistence | [docs/PROJECT_PERSISTENCE.md](docs/PROJECT_PERSISTENCE.md) |
| AI suggestion format | [docs/AI_SUGGESTION_FORMAT.md](docs/AI_SUGGESTION_FORMAT.md) |
| Agent / MCP workflow | [docs/AGENT_WORKFLOW.md](docs/AGENT_WORKFLOW.md) |
| Testing strategy | [docs/TESTING.md](docs/TESTING.md) |
| UI testing (Playwright harness) | [docs/UI_TESTING.md](docs/UI_TESTING.md) |
| Planning | [GitHub Issues](https://github.com/regionstockholm/intehrgrator/issues) — see [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md) |
| Archived roadmap | [docs/historical-archive/ROADMAP.md](docs/historical-archive/ROADMAP.md) |
| Deferred ideas | [docs/future/](docs/future/) |

## AI-assisted development

### Agent instructions

- **[AGENTS.md](AGENTS.md)** — documentation sources, Deno toolchain, issue tracker, domain docs.
- **[docs/TESTING.md](docs/TESTING.md)** — test seams, facets, green-path, CI gates (read when adding tests).
- **[docs/agents/](docs/agents/)** — issue tracker conventions, triage labels, domain modelling.

### Skills (Matt Pocock engineering skills)

The repo ships [Matt Pocock skills](https://github.com/mattpocock/skills) in `.cursor/skills/` and `.agents/skills/` for Cursor and other agents:

```bash
npx skills@latest add mattpocock/skills --agent cursor --skill '*' --yes --copy
```

Useful skills for this project:

| Skill | When |
|-------|------|
| `domain-modeling` | Editing CONTEXT.md or ADRs |
| `implement` / `tdd` | Feature work test-first |
| `diagnosing-bugs` | Hard bugs with runtime evidence |
| `code-review` | Reviewing diffs against standards and spec |
| `triage` | GitHub issue triage |
| `research` | Primary-source investigation |

Project-specific:

| Skill | When |
|-------|------|
| `intehrgrator-mapping` | Driving mappings via desktop Agent API / MCP |

Refresh project skills from the lockfile in `.agents/skills/` when upstream changes.

### Recommended MCP servers

| Server | Purpose |
|--------|---------|
| **DeepWiki** | ehrtslib, archie, openEHR repos — `read_wiki_structure`, `ask_question` |
| **openEHR assistant** | Archetypes, templates, terminology, spec lookup |
| **intEHRgrator** (local) | `deno task mcp` against a running desktop session, or headless with no `INTEHR_AGENT_URL`. Desktop also accepts `intEHRgrator --headless --load project.intehrgrator`. |

Configure MCP in `.cursor/mcp.json` (see [docs/AGENT_WORKFLOW.md](docs/AGENT_WORKFLOW.md) for the desktop URL).

### Issue tracker

GitHub Issues via `gh`. Conventions: [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md). Triage labels: [docs/agents/triage-labels.md](docs/agents/triage-labels.md).

## Libraries

- [ehrtslib](https://github.com/ErikSundvall/ehrtslib) — openEHR TypeScript (vendored via `deno task vendor`)
- [openEHR-model-examples](https://github.com/Ehrlibs/openEHR-model-examples) — demo templates
- [fontoxpath](https://github.com/FontoXML/fontoxpath) — source XPath evaluation
- [Blockly 11](https://developers.google.com/blockly) + [CodeMirror 6](https://codemirror.net/)
