# intEHRgrator

Visual integration workbench for healthcare informaticians: map source data (JSON, XML, openEHR compositions) into openEHR templates, JSON Schema, XML Schema, or free-form text — then test and export conversion scripts.

**Audience:** medical informaticians, clinical super-users, and technically minded business developers mapping clinical data.

## Try it

| Option | URL |
|--------|-----|
| **Web app (latest)** | [regionstockholm.github.io/intehrgrator/](https://regionstockholm.github.io/intehrgrator/) |
| **Pinned web versions** | [versions.json](https://regionstockholm.github.io/intehrgrator/versions.json) lists stable URLs such as `…/v0.7/` |
| **Desktop app** | [GitHub Releases](https://github.com/regionstockholm/intehrgrator/releases) — Windows, Linux, macOS; no install of Deno required |

The site root always tracks the latest `main` build and may change day to day. Use a `/vX.Y/` URL or a desktop release when you need a stable baseline for production mapping work.

## Get started

1. Open the [web app](https://regionstockholm.github.io/intehrgrator/) or download a [desktop build](https://github.com/regionstockholm/intehrgrator/releases).
2. Read the **[User tutorial](docs/TUTORIAL.md)** — a short walkthrough of every major feature.
3. Click the **ⓘ** tips in the interface for context-sensitive help on panes and controls.

## Report issues and ideas

We welcome bug reports and feature requests:

- **[Open a GitHub issue](https://github.com/regionstockholm/intehrgrator/issues/new/choose)** — describe what happened, what you expected, and attach a `.intehrgrator` project export if you can.
- The in-app **Help** menu links here too.

## Learn more

| Topic | Document |
|-------|----------|
| Tutorial (all features) | [docs/TUTORIAL.md](docs/TUTORIAL.md) |
| Terminology glossary | [CONTEXT.md](CONTEXT.md) |
| openEHR primer | [docs/OPENEHR_PRIMER.md](docs/OPENEHR_PRIMER.md) |
| Contributing / development | [README-DEVELOPERS.md](README-DEVELOPERS.md) |

## Libraries

Built on [ehrtslib](https://github.com/ErikSundvall/ehrtslib) (openEHR TypeScript), [Blockly](https://developers.google.com/blockly), [CodeMirror](https://codemirror.net/), and [fontoxpath](https://github.com/FontoXML/fontoxpath).
