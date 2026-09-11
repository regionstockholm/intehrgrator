# XQuery engine oracle (BaseX)

Generated Conversion Scripts are XQuery 3.1 and stay **generate-only** in the
app (ADR 0003). This page is the later engine check: run a `.xq` in a real
processor so Mapping preview / TypeScript are not the only oracles.

**In-app Conversion Test Run does not execute `.xq`.** That stays a follow-up.

## Choice: BaseX

Use **BaseX** as the optional engine oracle.

| Reason | Detail |
|--------|--------|
| XQuery 3.1 maps/arrays | Lookup `?` and `?*` match the JSON `$source?patient?systolic` emit |
| `fn:parse-json` / `json-doc` | W3C maps, not BaseX's default JSON-as-XML |
| CLI | `basex -Q convert.xq` — no server |
| License | BSD; zip install, no root |
| Java | 17+ (Cloud Agent images already ship a JDK) |

**Saxon-HE** is the documented alternative (same `.xq`, more ceremony to bind
JSON as a map). Do not add a second required engine. eXist-db is a server, not
a CI CLI.

Golden CI against BaseX is still a child of #39 (full COMPOSITION XML + always-on
job). Until then, `test/xquery_engine_test.ts` **skips** when `basex` is missing.

## Cloud Agent / VM hints

1. Java 17+ on `PATH` (`java -version`). Cursor Cloud images already have this.
2. Install BaseX into `$HOME/basex` (no root):

```bash
bash scripts/install-basex.sh
export BASEX_HOME="$HOME/basex"
export PATH="$BASEX_HOME/bin:$PATH"
```

Override the zip with `BASEX_ZIP_URL` if needed. Default is the pinned
`https://files.basex.org/releases/12.4/BaseX.zip` (the `BaseX-latest.zip` alias
404s; dated names under `/releases/latest/` change). `BASEX_HOME` / `BASEX_BIN`
are the env vars the test runner reads; it also looks in `$HOME/basex/bin`.

3. Allow egress to `files.basex.org` (and `docs.basex.org` if you need to
   re-check CLI flags). The zip is ~13 MB.
4. Run: `deno test -A --no-check test/xquery_engine_test.ts` and
   `test/codegen_test.ts`. Ordinary `deno task test` stays green without BaseX.

Do **not** vendor BaseX JARs in this repo. Do **not** put BaseX on the required
CI path until the #39 child (engine golden) lands.

## How a generated script is bound

Scripts declare:

```xquery
declare variable $source external;
declare variable $defaults as map(*) external := map {};
declare variable $sheets as map(*) external := map {};
```

JSON source **must** be an XPath 3.1 map/array (so `?` lookup works). The test
helper `materializeXQueryExternals` rewrites those declarations to:

```xquery
declare variable $source := parse-json(unparsed-text("file:///.../source.json"));
```

That rewrite is portable (BaseX and Saxon-HE). Do **not** use BaseX
`json:parse` default format — that yields JSON-as-XML, and `?` lookup fails.

`$sheets` is a map of name → grid (`headers` + `values` arrays), the same
shape TypeScript `sheets` uses (ADR 0005).

XML sources: bind `$source` as a node (`doc(...)`) and keep literal `/` paths.

## Saxon-HE (alternative)

Same materialized `.xq`. Typical query:

```text
java -cp saxon-he.jar net.sf.saxon.Query -q:convert.xq
```

Prefer `parse-json(unparsed-text(...))` over processor-specific JSON flags so
the generated script does not fork.

## Related

- [future/xquery-export-investigation.md](future/xquery-export-investigation.md)
- [ADR 0003](adr/0003-mapping-preview-vs-generated-script.md)
- Issue #39 (loops emit); child issue: full COMPOSITION XML + CI golden
