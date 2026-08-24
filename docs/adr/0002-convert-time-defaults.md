# Convert-time Defaults Map, not baked literals

Generated Conversion Scripts take a `defaults` map argument and resolve **Map lookup**s at convert time (Test Run passes the Map plugged into the **Defaults block**). Baking `ctx` scalars into the script would make mappings non-reusable across sites and messages. Hardcoding a particular slot is an authoring act: replace that slot’s Map lookup with a literal on the canvas.

**Considered:** inlining current Defaults Map values at codegen time — simpler scripts, but a language/territory change would require regenerating the mapping, which is the opposite of simplified-format `ctx`.
