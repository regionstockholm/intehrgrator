# XQuery engine golden tests (Cloud Agents)

**Status:** Optional CI / local harness — generated `.xq` modules are not executed in-app Test Run (see ADR 0003).

## Engine choice: BaseX (primary), Saxon-HE (alternative)

| Engine | Why |
|--------|-----|
| **[BaseX](https://basex.org/)** (recommended) | Single static binary, easy `apt`/download install on Linux Cloud Agent VMs, strong XQuery 3.1 + JSON/map support, simple CLI (`basex -q`). |
| **[Saxon-HE](https://www.saxonica.com/html/saxon-he/)** (alternative) | Industry-standard XQuery 3.1; needs Java on PATH. Use when BaseX JSON/map behaviour differs from Saxon in a golden fixture. |

Default harness in this repo targets **BaseX 11.x**. Saxon notes are included where flags differ.

## What the generated module expects

`generate(model, "xquery")` emits a module that:

1. Declares `declare variable $source external;` — bind to an XPath 3.1 **map** (JSON) or XML document root.
2. Optionally declares `$defaults` and `$sheets` when the mapping uses Defaults Map / Sheet accessors.
3. Exposes `local:convert($source)` returning `<mapping-result>` with:
   - `<slots>` — root-level mapped values
   - `<loops>` — one `<loop>` per Mapping Model `loops[]` entry, each containing `for $var in … return <item>…</item>`

Literal fontoxpath paths (`$.foo`, `/patient/name`) compile inline; dynamic paths call `local:source-nodes` / `local:*-at` and error at runtime with `DYNAMIC-*` QNames.

## Cloud Agent setup (BaseX)

```bash
# Debian/Ubuntu VM (Cloud Agent image)
sudo apt-get update && sudo apt-get install -y basex

basex -V   # expect BaseX 11.x
```

If `apt` is unavailable, download the portable ZIP from [basex.org/download](https://basex.org/download) and put `basex` on `PATH`.

## Running a generated module manually

```bash
# 1. Export from a Mapping Model (or use test fixture output)
deno task test -- test/codegen_test.ts

# 2. Write source JSON as an XQuery map (BaseX)
SOURCE='map { "measurements": array { map { "pulse": 72 }, map { "pulse": 80 } } }'

# 3. Evaluate (inline — good for smoke tests)
basex -q "xquery version \"3.1\";
  declare variable \$source external := ${SOURCE};
  %PATH/to/generated.xq"
```

For file-based runs, use the helper script:

```bash
deno run -A scripts/run-xquery-basex.ts \
  --xq /tmp/mapping.xq \
  --json test/fixtures/legacy-simulated-json/instances-series/bp-series-inst.json
```

The script:

- Converts JSON instance files to an XQuery map literal (BaseX `json:parse` when available, else a minimal map builder).
- Binds `$source` (and `$defaults` / `$sheets` when `--defaults` / `--sheets` paths are passed).
- Prints serialized XML to stdout; non-zero exit on XQuery errors.

## Automated golden test (optional)

```bash
deno task test:xquery-engine
```

`test/xquery_engine_test.ts` **skips** when `basex` is not on `PATH`. Enable in Cloud Agent `environment.json` install steps when XQuery golden runs should gate CI:

```json
{
  "install": "sudo apt-get update && sudo apt-get install -y basex"
}
```

## Saxon-HE equivalent (sketch)

```bash
java -cp saxon-he-12.x.jar net.sf.saxon.Query \
  -qs:"import module namespace local=\"\"; …" \
  -s:source.json
```

Saxon JSON→map binding differs by version; prefer BaseX for first golden fixtures unless Saxon is already the deployment engine.

## Known limits (issue #39 scope)

- **Model B only** — flat `<mapping-result>` slot manifest + loop items, not full COMPOSITION RM XML trees (child issue after loops ship).
- **`sheet_get_*`** — export fails with `XQueryExportError`; only `sheet_lookup` is emitted today.
- **`decision_table()`** — export fails; use Mapping preview / TypeScript.
- **Removed Blockly types** — export fails if `unsupported[]` lists `reason: "removed"`.

## Related

- [xquery-export-investigation.md](../future/xquery-export-investigation.md)
- [ADR 0003](../adr/0003-mapping-preview-vs-generated-script.md) — preview vs generated oracles
- GitHub issue [#39](https://github.com/regionstockholm/intehrgrator/issues/39)
