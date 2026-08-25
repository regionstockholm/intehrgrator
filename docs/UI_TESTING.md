# UI Testing (v1)

First-cut browser tests for the Web Shell Mapping Editor: prove that **Click-to-Map** and **drag-and-drop mapping** produce Blockly `source_query` blocks and sensible **Test Run** results in Target & Previews.

Inspired by kintegrate’s `formTestApi` + browser harness pattern ([CyEmulator / formTestApi](https://deepwiki.com/ErikSundvall/kintegrate)), adapted to Deno + Playwright.

## Goals

| Goal | v1 approach |
|------|-------------|
| Avoid fragile file-picker automation | **Workbench Test API** loads OPT / Source Schema / Example Instance from fixture strings |
| Still exercise real UI | Arm by clicking the Blockly Target value slot + click Example Instance (Click-to-Map); HTML5 drag from Example Instance onto the Blockly slot; **Run Test** |
| Assert sensible output | Mapping Model expression, Blockly `source_query` block, Test Run slot value, `#test-output` text |
| Stay Deno-native | `deno task test:ui` builds, serves `dist/`, runs Playwright under Deno |

## Workbench Test API

Enabled only when the shell is opened with `?testMode=1`.

| Method | Role |
|--------|------|
| `ready()` | Resolves after Blockly inject + first render |
| `loadTemplate` / `loadSchema` / `addExample` | Fixture setup (no Host file picker) |
| `armSlot` / `bindFromNode` | Programmatic equivalents of Click-to-Map (available; UI test prefers DOM clicks) |
| `mapNodeToSlot` | Programmatic equivalent of drag-and-drop (skips Listening Mode) |
| `runTest` / `setAutoplay` | Drive Conversion Test Run(s) |
| `getSnapshot()` | Mapping Model, Test Run result, Blockly block summary, listening/selection ids |
| `findSlotIdBySuffix` | Stable slot lookup for long OPT slotIds |
| `getBlockClientRect` | Blockly block SVG client rect for real UI click / drop |
| `clickBlock` | Select a Blockly block (same path as a canvas click; arms Listening Mode when unmapped) |
| `scrollBlockIntoView` | Pan the Blockly canvas so a block is in view |

Global: `window.intehrgratorTestApi` (types in `src/ui_test/test_api.ts`).

## Running

```bash
deno task vendor   # once
deno task test:ui  # build + serve + Playwright
```

Skip rebuild when iterating:

```bash
UI_TEST_SKIP_BUILD=1 deno task test:ui
```

Unit tests remain `deno task test` (no browser).

## Fixtures

| File | Use |
|------|-----|
| `test/fixtures/blood_pressure.opt` | Target Template Skeleton |
| `test/fixtures/ui/bp_source_schema.json` | Source Schema |
| `test/fixtures/ui/bp_example.json` | Active Example (`systolic: 120`) |

Primary scenarios map systolic (`…/items/at0004/value/value/value`) → `$.systolic` and expect Test Run slot value `120`:

| Test | Interaction |
|------|-------------|
| `test/ui/click_to_map_test.ts` | Listening Mode → click Example Instance node |
| `test/ui/drag_drop_map_test.ts` | Drag Example Instance node onto Blockly Target value slot (no Listening Mode) |

Shared helpers live in `test/ui/helpers.ts` (including `html5DragDrop` for reliable DataTransfer MIME payloads under Playwright).

## What this does *not* cover yet

- Full Generated Export execution through ehrtslib Composition builders (Test Run is still slot-evaluation preview — see architecture deepening candidates)
- Drag-and-drop onto the Blockly canvas (covered by `drag_drop_map_test.ts`)
- Autoplay debounce behaviour
- VS Code webview host (same Test API should mount there later behind Host Abstraction)
- openEHR-as-source (future Source Format Handler)

## CI

`deno task test:ui` is available locally and can be added as a CI job once Chromium install time is acceptable for the runners. Unit `deno task test` stays the default gate.
