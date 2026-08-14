# XData

Human and machine editable (round-trip-able) yaml-like serialization format with string interpolation. Programmatically add/remove comments.

```js
import { parse, stringify, toJs, getNode, setKey, push, addComment } from "./main/main.js"

const text = `# server config
name: "api-server"
port: 8080
host: #valueOf[name]
greeting: 'hello from {#valueOf[name]}!'
tags: [@prod, @linux]
limits:
    memory: 512
    workers: 4
`

// one-way to plain JS (refs resolved, strings interpolated, comments dropped)
toJs(text)
// { name: "api-server", port: 8080, host: "api-server",
//   greeting: "hello from api-server!",
//   tags: [Symbol(prod), Symbol(linux)],
//   limits: { memory: 512, workers: 4 } }

// lossless editing
const doc = parse(text)
setKey(doc, "port", 9090)                        // change a scalar
setKey(getNode(doc, ["limits"]), "timeout", 30)  // add a nested key
push(getNode(doc, ["tags"]), Symbol.for("arm"))  // append to a list
addComment(doc, "edited programmatically")
Deno.writeTextFileSync("config.xd", stringify(doc))
// comments, references, and all original formatting are preserved
```

## Layout

- `main/` — the implementation (plain JS, runs on Deno); `main/main.js` is the one import
- `test_cases/` — round-trip corpus (`stringify(parse(text)) === text` for every file)
- `run/tests.ps1` — the test suite: `sh run/tests.ps1` (or `deno run -Aq run/all_tests.js`)
- `outline.yaml` — grammar spec; `explanation.yaml` — design notes; `decisions.md` — settled design decisions
- `old/` — a previous implementation attempt, kept for reference

## Format cheat sheet

- comments `# like this`, block maps `key: value`, block lists `- value`, inline `[1, 2]` / `{ a: 1 }`
- atoms `@red` (→ `Symbol.for("red")`), special values `true/false/null/undefined/NaN/infinity`
- strings: `"literal"` / `'figurative'` (figurative supports `{#tab}`, `{#unicode[1F600]}`, `{#valueOf[key]}` interpolation); quote runs escalate by powers of three (`"`, `"""`, 9)
- block strings: quotes at end of line, indented content, closing-quote-line indent is stripped
- references `#valueOf[key, subkey, 0]` resolve during `toJs`; cycles throw
