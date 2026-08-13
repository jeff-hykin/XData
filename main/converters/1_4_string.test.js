// assertion-based checks for string parsing (inline, block, figurative)
// run with: deno run -Aq 1_4_string.test.js
import "../main.js" // load all converters into the registries
import * as structure from "../structure.js"
import { stringToNode, stringNodeToString, blockStringLiteralToNode, minimumViableQuoteSize } from "./1_4_string.js"
import { toJs, parse, stringify } from "../main.js"

const assert = (label, condition)=>{
    if (!condition) {
        throw Error(`FAILED: ${label}`)
    }
    console.log(`pass: ${label}`)
}
const roundTrips = (text)=>{
    const node = stringToNode({ remaining: text, context: new structure.Context({}) })
    return stringNodeToString({ node, context: new structure.Context({}) }) === text
}

assert(`inline literal`, roundTrips(`"testing"`))
assert(`triple-quoted inline`, roundTrips(`"""howdy"""`))
assert(`quotes inside triple quotes`, roundTrips(`""" "howdy" """`))
assert(`empty string`, roundTrips(`""`))
assert(`empty triple-quoted string`, roundTrips(`""""""`))
assert(`figurative inline`, roundTrips(`'howdy'`))

assert(`minimum viable quote size escalates by powers of three`,
    minimumViableQuoteSize(`plain`, `"`) == 1
    && minimumViableQuoteSize(`has " one`, `"`) == 3
    && minimumViableQuoteSize(`has """ three`, `"`) == 9
)

const blockText = `"""\n    Howdy howdy howdy\n    Howdy howdy howdy\n    """`
{
    const node = blockStringLiteralToNode({ remaining: blockText, context: new structure.Context({}) })
    assert(`block literal round-trips`, stringNodeToString({ node, context: new structure.Context({}) }) === blockText)
}
assert(`block literal strips closing indent in toJs`, deepEqualString(
    toJs(`value: """\n    Howdy\n        indented\n    """\n`).value,
    "Howdy\n    indented",
))
assert(`block figurative interpolates`, deepEqualString(
    toJs(`name: "world"\nvalue: '''\n    hi {#valueOf[name]}{#tab}!\n    '''\n`).value,
    "hi world\t!",
))
assert(`whole document with block string round-trips byte-exact`, (()=>{
    const text = `note: """\n    line one\n    line two\n    """\nafter: 1\n`
    return stringify(parse(text)) === text
})())

function deepEqualString(a, b) {
    if (a !== b) {
        console.error(`expected ${JSON.stringify(b)}\n     got ${JSON.stringify(a)}`)
    }
    return a === b
}
console.log("all string tests passed")
