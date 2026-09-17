# join_list Blockly prototypes (#85)

Throwaway design capture. The live playground is `web/prototype-join-list.html`
(built to `dist/prototype-join-list.html`). Prototype block types live in
`src/blockly/blocks/join_list_prototype.ts` and are **not** on the production
toolbox.

**Question:** what should an informatician *see* when they turn
`["Anna","Bo","Carl"]` into `Anna, Bo och Carl`?

Run: `deno task prototype:join-list` then `deno task dev` and open
[http://127.0.0.1:5173/prototype-join-list.html?variant=A](http://127.0.0.1:5173/prototype-join-list.html?variant=A).
← → cycles A–F.

Inspiration (Erik’s map-as-scaffolding, 2026-09-17):

![Map used as a join recipe: prefix, first, default, last, postfix](join-list/inspiration-map-scaffolding.png)

Real Blockly (modest theme). Live playground: `deno task prototype:join-list` then
`deno task dev` → http://127.0.0.1:5173/prototype-join-list.html?variant=A

### A — Compact Text reporter

![A compact join_list](join-list/join_list_variant_a_compact_join_list.png)

### B — Named mouths (map scaffolding, cleaned up)

![B named-slot recipe](join-list/join_list_variant_b_named_slot_recipe.png)

### C — Locale / style dropdown

![C locale preset](join-list/join_list_variant_c_locale_preset.png)

### D — Decision table over list position

![D decision table + first/last](join-list/join_list_variant_d_decision_table_first_last.png)

### E — Loop index and length

![E index and length locals](join-list/join_list_variant_e_loop_index_length.png)

### F — Blockly function; compact mapping call

![F function definition plus ELEMENT call sites](join-list/join_list_variant_f_function_mapping_call.png)

---

## Variants

| Key | End-user shape | Lowers to | v1? |
|-----|----------------|-----------|-----|
| **A** Compact `join_list` | Yellow Text reporter: list + *between* + *before last* | `join_list(items, sep, finalSep)` | **Yes** — cheapest authoring for list grammar |
| **B** Named mouths | Same algebra + prefix/postfix + skip-empty. Teal “item templates” are a counter-example | `concat(prefix, join_list(...), postfix)` | Yellow part yes; teal lambdas **no** |
| **C** Locale preset | List + `Svenska (och)` / English / Oxford dropdown | Same two strings as A | Later; #85 listed locale auto-detect as a non-goal |
| **D** Decision table over position | `join list using decision`; sheet rows on `first`/`last` | Per-item FIRST table, concatenate snippets | **Yes, alongside A** |
| **E** Loop `index` + `length` | Same table; `first`/`last`/`odd` derived with Math | `index = 0`, `index = length − 1`, `index mod 2` | **Yes as loop binders** — substrate for D |
| **F** Function + mapping call | Stock `to join_swedish(names)` wrapping A; ELEMENT Närvarande calls it | `join_swedish(source list)` at the slot | **Yes as authoring** — compact main code; call serialization still an escape hatch |

**A and D are both worth shipping.** A is faster for ordinary Oxford / *och*.
D (powered by E’s binders) is faster when the per-item rule is a table
(title-case the first, period on the last, zebra, “first three get a heading”).
Lung-MDT `#each` + `@first`/`@last` is a **semantic transform** onto these
binders — do not keep the Handlebars names for compatibility.

**Compact main code (variant F):** extract a 1-arg helper
(`join_swedish(names)`) with the yellow `join_list` in the function body.
The Mapping Model is then `ELEMENT Närvarande → DV_TEXT.value = join_swedish(source list)`.
A 3-arg `join_list(items, sep, final)` *function* is no smaller than putting A
on the slot; the win is baking separators into a named helper and reusing it.
`procedures_callreturn` is still a Mapping IR escape hatch until see-through
calls ([function-test-harnesses.md](../future/function-test-harnesses.md)).

The teal block on variant B is what the map scaffolding *wants* if
`first`/`default`/`last` are per-item expressions. Those sockets are lambdas
(`item → string`). Mapping Expression has no lambdas; `logic_list_restriction`
is the only binder today. Do not take that into v1.

---

## Loop `index` and `length` — does that make verification harder?

**No, not in kind.** It adds two integers per iteration, both derived and
bounded.

| Binder | Meaning | SMT |
|--------|---------|-----|
| `item` (already) | Current element | Same as today |
| `index` | `0 … length−1` | `0 ≤ index < length` |
| `length` | `\|collection\|` at loop entry | Constant for the loop (VMS has no list mutators) |

`is first` ⇔ `index = 0`. `is last` ⇔ `index = length − 1`. Odd/even ⇔
`index mod 2` (already a VMS Math block). Handlebars `@index` / `@first` /
`@last` rewrite onto that table; `@key` stays map iteration only.

**Where to bind:** emission loops — `for_each_source` and `for_each_list` —
with child reporters that pick the enclosing binder (same dropdown pattern as
`logic_current_item`). Nested loops need distinct names (`name` / `name_index`,
or a nearest-enclosing picker).

**Where not to bind in v1:** `logic_list_restriction`. Quantifiers should stay
order-insensitive (`all of list match P(item)`). Index there makes “the first
specimen must be labelled” easy and also makes accidental positional bugs easy.

**Verification caveats (not holes):**

1. Grain still means “add one source node → add one target child.” Do not use
   `index` to mint `:n` slot ids.
2. `length` must be the collection as of loop entry, not a live mutating size.
3. Nested loops: two index/length pairs, not a global `@index`.

Slightly more SMT state per iteration; same fragment as a bounded `for`.

---

## Would banning `@first` / `@last` enable Handlebars verification?

**No**, and we do not need those names for lung-MDT compatibility. Snippet
cells already cannot use them (VMS-Mustache, [ADR 0009](../adr/0009-verifiable-template-dialects.md)).
They are index predicates, not the opaque hole (`lookup`, `#with`, lambdas,
unknown helpers). Once `#each` is rewritten to `join_list` and/or a position
table, VMS-Hbs can drop `@first`/`@last` (and `@index` if the loop binders
cover it).

COLLECT vs join: COLLECT still answers “which clinical fragments belong.”
`join_list` / the position table answers “how do I punctuate this list of
strings.” They compose.

---

## Recommendation for #85 implementation

1. Ship **A** (`join_list`) — cheapest authoring for Oxford / *och*.
2. Ship **D** as well: per-item Decision table + VMS-Mustache snippets. Same
   verification track; better when the per-item rule is a table.
3. Bind **index** and **length** on `for_each_*` (variant E). Derive
   `is first` / `is last` from them. That is the substrate D needs, and the
   semantic image of lung-MDT `@index` / `@first` / `@last`.
4. Optional yellow-B mouths (prefix/postfix/skip-empty); no teal lambdas.
5. For compact Mapping Model slots, extract a 1-arg Blockly Function
   (`join_swedish`) wrapping A rather than repeating separators on every ELEMENT.
6. Do not keep VMS-Hbs `@first`/`@last` for compatibility. Transform, then
   drop.
