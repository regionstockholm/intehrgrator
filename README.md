# intEHRgrator

Visual integration workbench for healthcare informaticians: map source data (JSON, XML, openEHR compositions) to openEHR templates and other target formats, test the result on example instances, and export conversion scripts.

Built for **medical informaticians**, **clinical super users**, and **tech-interested business developers** who need to author and maintain data mappings without writing everything by hand.

## Try it

| Where | URL | Notes |
|-------|-----|-------|
| **Web app (latest)** | [regionstockholm.github.io/intehrgrator/](https://regionstockholm.github.io/intehrgrator/) | Cutting-edge build from `main`; may change between visits |
| **Pinned web versions** | [versions.json](https://regionstockholm.github.io/intehrgrator/versions.json) | Stable URLs such as `…/intehrgrator/v0.7/` — use these when you need a fixed release |
| **Desktop app** | [GitHub Releases](https://github.com/regionstockholm/intehrgrator/releases) | Offline-friendly native window; includes Agent API and MCP for IDE workflows |

Click the **(i)** tips throughout the UI for short explanations of each pane and control.

## Learn the tool

- **[Tutorial](docs/TUTORIAL.md)** — walkthrough of every major feature (source, target, mapping, test run, export, projects, AI assist)
- **[Glossary](CONTEXT.md)** — precise names for panes, blocks, and concepts used in the UI and docs

## Report bugs and request features

We welcome bug reports, usability feedback, and feature ideas.

1. Open **[GitHub Issues](https://github.com/regionstockholm/intehrgrator/issues/new)** (also linked from the app status bar).
2. Describe what you tried, what you expected, and what happened instead.
3. Attach a saved **Project** (`.intehrgrator` export) or screenshots when that helps.

Use the same place for **feature requests** — tell us the workflow you are trying to support.

## For developers

See **[README-DEVELOPERS.md](README-DEVELOPERS.md)** for Deno setup, tasks, architecture notes, and AI-assistant configuration.
