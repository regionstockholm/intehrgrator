# intEHRgrator

Visual workbench for mapping source data (JSON, XML, or openEHR) onto a chosen **target** — an openEHR template, a JSON/XML schema, or a free-form text document — and producing a conversion script you can run in your own pipeline.

Intended for **medical informaticians**, clinical super users, and technically interested business developers. You do not need to install a compiler to try it.

## Open the workbench

**Web (always the latest `main` build — can change under you):**
[https://regionstockholm.github.io/intehrgrator/](https://regionstockholm.github.io/intehrgrator/)

**Web (frozen copies of released versions):** each desktop release also publishes an immutable site under a version path, for example `https://regionstockholm.github.io/intehrgrator/v0.7/`. The live list is [versions.json](https://regionstockholm.github.io/intehrgrator/versions.json). Prefer a frozen URL when you are demonstrating, training, or validating a mapping you must be able to reopen later.

**Desktop (runs only on `127.0.0.1`, no GitHub Pages):** download a platform build from [Releases](https://github.com/regionstockholm/intehrgrator/releases). Unzip/run next to the other files in the archive (on Windows, keep `intEHRgrator.exe` beside `intEHRgrator.dll`). Linux AppImage: `chmod +x` first.

## Learn it

1. Click **Help** in the toolbar (tutorial, issue reporting, this copy’s version).
2. Click the encircled **i** next to Schema, Examples, target Open, and Output mode for short format notes.
3. Read the [end-user tutorial](docs/TUTORIAL.md) — three panes, Click-to-Map, Test Run, save/export, and AI assist.

Fastest first run: **Example Sets ▾** and pick a catalogued set.

## Something wrong — or a feature you want?

GitHub Issues are the inbox. You do **not** need to be a developer. **Feature requests are welcome** as well as bugs.

- In the app: **Help** → **Report a problem** or **Request a feature**
- On GitHub: [new issue](https://github.com/regionstockholm/intehrgrator/issues/new/choose)

Paste the version string from the footer (or **Help → Copy version**) into the report. Frozen web copies put the version in the URL (`/v0.7/` and so on).

## Developers

Build, Deno tasks, ADRs, glossary, and AI/MCP setup: [README-DEVELOPERS.md](README-DEVELOPERS.md).
