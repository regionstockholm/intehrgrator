# Java / Archie conversion-script export

`generate(model, "java")` walks the **Template Skeleton** plus **Mapping Model**
expressions (`slots[]`, `loops[]`) and emits a compilable Archie conversion
class — the same IR path as TypeScript / ehrtslib, not a second Blockly pass.

Web Shell **Output mode Java** shows the generated source. It does **not**
execute the class in the browser (no bundled JVM). Compile and run it on a
server or CI JVM. Conversion Test Run for Java remains unimplemented
(`unimplementedTestRunMessage`); see [ADR 0003](adr/0003-mapping-preview-vs-generated-script.md).

## What the class looks like

Package `se.regionstockholm.intehrgrator.generated`, class `ConversionScript`:

- `convert(Object source, Map<String, Object> defaults)` — JSON (`Map` /
  Jackson tree / JSON string) or XML (`org.w3c.dom.Node` / XML string).
- Overload with `Map<String, Sheet> sheets` for `sheet_lookup` / decision tables.
- Nested `rm(new Observation(), o -> { o.setData(…); })` for containers;
  compact constructors for data values (`new DvQuantity(units, magnitude, null)`,
  `new DvText(…)`, `new CodePhrase("ISO_639-1::en")`).
- `for_each_source` → `xpathNodes(path).stream().map(var -> …).toList()` with
  relative xpath against the loop node.
- `maps_get("defaults", key)` → `defaults.get(key)`.

### Convert-then-validate hook

Pass an **ADL2** `OperationalTemplate` to the constructor (or
`ConversionScript.fromAdl2Opt(InputStream)` / `fromAdl2Opt(String)`) so `convert` calls Archie's
`RMObjectValidator` after building the composition. OPT 1.4 XML from Ocean /
CKM is not parsed here — flatten or convert to ADL2 first.

```java
ConversionScript script = ConversionScript.fromAdl2Opt(Files.newInputStream(optPath));
Composition composition = script.convert(sourceMap, defaults);
```

## Dependency

Current Archie coordinates ([openEHR/archie README](https://github.com/openEHR/archie)):

**Gradle**

```gradle
dependencies {
    implementation 'com.nedap.healthcare.archie:archie-all:3.20.0'
}
```

**Maven**

```xml
<dependency>
  <groupId>com.nedap.healthcare.archie</groupId>
  <artifactId>archie-all</artifactId>
  <version>3.20.0</version>
</dependency>
```

`archie-all` is a POM aggregator (RM, AOM, tools, Jackson). Older docs sometimes
wrote `com.nedap.archie:archie`; that groupId is not what Maven Central publishes
for Archie 3.x.

Jackson is a transitive dependency and is what the generated xpath helpers use
for JSON paths. XML paths (`/…`) use the JDK `javax.xml.xpath` APIs.

## Optional compile check

Golden string tests live in `test/codegen_test.ts` (always run). An optional
JVM compile against downloaded Archie jars runs in
`test/java_archie_compile_test.ts` when `java`/`javac` are on `PATH`, `javac`
supports `--release 21`, and Maven Central is reachable. It **skips** (does not
fail) when the JDK is too old — GitHub Actions' default `javac` historically
could not `--release 21`; CI now installs Temurin 21 so the compile actually
runs there. Skip with `SKIP_ARCHIE_COMPILE=1`. This repo does not vendor
Archie JARs and does not require Maven/Gradle for the Deno test suite.

```bash
deno test -A --no-check test/codegen_test.ts --filter java
deno test -A --no-check test/java_archie_compile_test.ts
```
