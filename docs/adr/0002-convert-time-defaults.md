# Convert-time Default context mapping, not baked literals

Generated Conversion Scripts take a `defaults` map argument (the UI name is **Default context mapping**) and resolve **Map lookup**s at convert time (Test Run passes the Map plugged into the **Defaults block**). Values may be scalars or nested maps/objects. Baking `ctx` into the script would make mappings non-reusable across sites and messages. Hardcoding a particular slot is an authoring act: replace that slot’s Map lookup with a literal on the canvas.

The canvas binding is a design-time stand-in: convert-time callers may supply a different `defaults` object. Keep the internal Map name `defaults`.

**Considered:** inlining current Default context mapping values at codegen time — simpler scripts, but a language/territory change would require regenerating the mapping, which is the opposite of simplified-format `ctx`.
