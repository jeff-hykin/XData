# Settled design decisions

Decisions that were open in the original outline/explanation, settled while getting the
implementation to round-trip (2026-08). Each is 1-2 lines; the code is the full spec.

## Parsing / syntax

- **Bareword map keys are allowed** (`name: 1`), matching `[a-zA-Z_][a-zA-Z_0-9]*`. The outline
  only showed quoted keys, but every example file used barewords.
- **Quote runs escalate by powers of three**: `"` → `"""` → 9 quotes. A run of 2 (e.g. `""`) is
  parsed as an empty 1-quote string, not an opening quote of size 2.
- **Block strings** open with a quote run followed by end-of-line; the indentation of the
  *closing* quote line is stripped from every content line, and the final newline before the
  closing quotes is not part of the value.
- **A literal `{` in a figurative string requires an escape section** — bare `{` only parses if
  it forms a valid `{#...}` escape; there is no `{{` escaping (unsettled in outline, kept strict).
- **Comments** are `# ` (or bare `#` at end of line); they attach to the structure as their own
  nodes (`entries` arrays, `leadingCommentsAndLines`, `trailingCommentsAndLines`) so they
  round-trip byte-exact.
- **Trailing comments/blank lines after a block's last entry belong to the parent**, not the
  block (parser saves/rolls back), so `addComment` on the document lands at document level.
- **Adjectives** `(sorted, unique)` parse and round-trip on atoms/strings/lists but are
  currently dropped by `toJs` (no semantic meaning yet).
- **Splat is not implemented** — deferred, nothing in the corpus needs it.

## toJs mapping

- **Atoms → `Symbol.for(name)`** (`@red` → `Symbol.for("red")`) so equal atoms are `===`.
- **Maps → plain object when every key is a string or symbol, otherwise a JS `Map`**
  (e.g. `{ 1: "one" }` → `Map`).
- **Special values**: true/false/NaN/undefined/±infinity as expected; `null`, `nil`, `none`,
  `nullptr` all → `null`. Case-insensitive.
- **A key with no value** (`key:` followed by nothing indented) → `null`.
- **References `#valueOf[a, b, 0]`** resolve against the document root during `toJs`; list
  segments must be numbers; cycles throw `Circular reference detected`; bad paths throw with
  the failing segment named.
- **Interpolated (figurative) strings** stringify each escape section's resolved value into the
  string; interpolating a non-primitive throws.

## Mutation API (`api.js`)

- `parse`/`stringify` are lossless inverses; `getNode(root, path)` walks keys/indices;
  `setKey`, `push`, `addComment` edit the node tree in place and preserve surrounding
  formatting (existing whitespace, entry indentation, final-newline placement).
- **New block entries copy the indentation of the block's first real entry**; a newline is added
  to the innermost last line first so appends never create stray blank lines.
- `jsToXdataText` creates inline text for JS values; strings containing newlines can't be
  created this way (throws) — build a block string node manually instead.

## Infrastructure

- **`deno.land/x` imports were replaced with `esm.sh/gh/jeff-hykin/good-js@1.5.0.0`** — the
  deno.land/x registry serves corrupt archives now, and the pinned deno 1.33.1 bootstrap was
  removed; everything runs on system deno (`XData/run/tests.ps1`).
