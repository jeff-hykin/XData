// run with:  deno run -Aq XData/run/all_tests.js
// exits non-zero if any assertion fails
import { parse, stringify, toJs, getNode, setKey, push, addComment } from "../main/main.js"

let testCount = 0
let failCount = 0
const check = (label, condition)=>{
    testCount += 1
    if (condition) {
        console.log(`    pass: ${label}`)
    } else {
        failCount += 1
        console.error(`    FAIL: ${label}`)
    }
}
const deepEqual = (a, b)=>{
    if (Object.is(a, b)) { return true }
    if (typeof a != typeof b) { return false }
    if (a instanceof Array && b instanceof Array) {
        return a.length == b.length && a.every((each, index)=>deepEqual(each, b[index]))
    }
    if (a instanceof Map && b instanceof Map) {
        return a.size == b.size && [...a.entries()].every(([key, value])=>b.has(key) && deepEqual(value, b.get(key)))
    }
    if (a instanceof Object && b instanceof Object && !(a instanceof Map) && !(b instanceof Map) && !(a instanceof Array)) {
        const aKeys = Reflect.ownKeys(a)
        const bKeys = Reflect.ownKeys(b)
        return aKeys.length == bKeys.length && aKeys.every(key=>deepEqual(a[key], b[key]))
    }
    return false
}

//
// 1. byte-exact round-trip of every corpus file
//
console.log("round-trip tests:")
const testCasesFolder = new URL("../test_cases/", import.meta.url)
const corpusFiles = [...Deno.readDirSync(testCasesFolder)].filter(each=>each.name.endsWith(".xd")).map(each=>each.name).sort()
check("corpus has at least 8 files", corpusFiles.length >= 8)
for (const eachName of corpusFiles) {
    const text = Deno.readTextFileSync(new URL(eachName, testCasesFolder))
    let roundTripped = null
    try {
        roundTripped = stringify(parse(text))
    } catch (error) {
        check(`${eachName} round-trips byte-exact (threw: ${error.message})`, false)
        continue
    }
    check(`${eachName} round-trips byte-exact`, roundTripped === text)
}

//
// 2. toJs deep-equal tests
//
console.log("toJs tests:")
check("scalars and special values", deepEqual(
    toJs(Deno.readTextFileSync(new URL("01_scalars_and_specials.xd", testCasesFolder))),
    {
        an_integer: 42, a_negative: -17, a_float: 3.14159,
        a_boolean: true, another_boolean: false,
        nothing: null, also_nothing: null, missing: undefined,
        not_a_number: NaN, big: Infinity, small: -Infinity,
        an_atom: Symbol.for("red"), another_atom: Symbol.for("some_long_atom_name"),
    },
))
check("nested block map", deepEqual(
    toJs(Deno.readTextFileSync(new URL("02_block_map_nested.xd", testCasesFolder))),
    { name: "Jeff", address: { street: "123 Fake St", city: "Austin", geo: { lat: 30.2672, lon: -97.7431 } } },
))
check("block lists incl. nested and list-of-maps", deepEqual(
    toJs(Deno.readTextFileSync(new URL("03_block_lists.xd", testCasesFolder))),
    {
        groceries: ["milk", "eggs", "bread"],
        matrix: [[1, 2], [3, 4]],
        people: [{ name: "Ada", born: 1815 }, { name: "Grace", born: 1906 }],
    },
))
check("inline collections incl. empty [] and {}", deepEqual(
    toJs(Deno.readTextFileSync(new URL("04_inline_collections.xd", testCasesFolder))),
    {
        empty_list: [], empty_map: {},
        numbers: [1, 2, 3],
        mixed: [1, "two", Symbol.for("three"), true, null],
        nested_inline: [[1, 2], [3, 4]],
        inline_map: { a: 1, b: 2 },
        map_in_list: [{ x: 1 }, { y: 2 }],
        list_in_map: { items: [1, 2], done: false },
    },
))
check("strings incl. block strings", deepEqual(
    toJs(Deno.readTextFileSync(new URL("07_strings.xd", testCasesFolder))),
    {
        simple: "hello world",
        with_quote: `she said "hi" to me`,
        empty_string: "",
        figurative_plain: "just text",
        block_literal: "line one\nline two\n    indented line",
        block_figurative: "tab here \t and done",
        final: "the end",
    },
))
check("references and interpolation", deepEqual(
    toJs(Deno.readTextFileSync(new URL("08_interpolation_and_references.xd", testCasesFolder))),
    {
        name: "world",
        greeting: "hello world!",
        tabbed: "a\tb",
        newline_in_string: "first\nsecond",
        emoji: "smile \u{1F600}",
        letter: "cap A",
        copy_of_name: "world",
        deep: { inner: 99 },
        deep_ref: 99,
        scores: [10, 20, 30],
        second_score: 20,
        chained: "value is 99",
    },
))
check("adjectives are dropped in toJs", deepEqual(
    toJs(Deno.readTextFileSync(new URL("09_adjectives.xd", testCasesFolder))),
    { color: Symbol.for("red"), tags: [3, 1, 2], plain_for_contrast: Symbol.for("blue") },
))
check("non-string keys produce a Map", (()=>{
    const result = toJs(`{ 1: "one", 2: "two" }`)
    return result instanceof Map && result.get(1) == "one" && result.get(2) == "two"
})())

//
// 3. reference errors
//
console.log("reference error tests:")
check("cyclic reference throws a clear error", (()=>{
    try {
        toJs("a: #valueOf[b]\nb: #valueOf[a]\n")
        return false
    } catch (error) {
        return error.message.includes("Circular reference")
    }
})())
check("missing reference key throws", (()=>{
    try {
        toJs("a: #valueOf[nope]\n")
        return false
    } catch (error) {
        return error.message.includes("wasn't found")
    }
})())
check("out-of-range list reference throws", (()=>{
    try {
        toJs("a: [1, 2]\nb: #valueOf[a, 5]\n")
        return false
    } catch (error) {
        return error.message.includes("out of range")
    }
})())

//
// 4. mutation API
//
console.log("mutation tests:")
{
    const doc = parse(`name: "Jeff"\nage: 24\nitems:\n    - 10\n    - 20\n`)
    setKey(doc, "age", 25)
    check("change an existing scalar", stringify(doc) === `name: "Jeff"\nage: 25\nitems:\n    - 10\n    - 20\n`)
    check("changed scalar re-parses equal", deepEqual(toJs(parse(stringify(doc))), { name: "Jeff", age: 25, items: [10, 20] }))

    setKey(doc, "city", "Austin")
    check("added map key appears with correct indentation", stringify(doc).includes(`\ncity: "Austin"\n`))

    push(getNode(doc, ["items"]), 30)
    check("pushed list element uses entry indentation", stringify(doc).includes(`\n    - 30\n`))

    addComment(doc, "generated by tests")
    const finalText = stringify(doc)
    check("programmatic comment lands on its own line", finalText.includes(`\n# generated by tests\n`))
    check("mutated document re-parses to expected values", deepEqual(
        toJs(parse(finalText)),
        { name: "Jeff", age: 25, items: [10, 20, 30], city: "Austin" },
    ))
    check("mutated document round-trips byte-exact", stringify(parse(finalText)) === finalText)
}
{
    const doc = parse(`outer:\n    inner: 1\n`)
    addComment(getNode(doc, ["outer"]), "inside the nested map", {index: 0})
    const text = stringify(doc)
    check("comment inside nested map keeps the nested indentation", text === `outer:\n    # inside the nested map\n    inner: 1\n`)
}
{
    const doc = parse(`list: [1, 2]\nmap: { a: 1 }\n`)
    push(getNode(doc, ["list"]), 3)
    setKey(getNode(doc, ["map"]), "b", 2)
    check("inline list push + inline map setKey re-parse equal", deepEqual(
        toJs(parse(stringify(doc))),
        { list: [1, 2, 3], map: { a: 1, b: 2 } },
    ))
}

//
// summary
//
console.log(`\n${testCount - failCount}/${testCount} tests passed`)
if (failCount > 0) {
    Deno.exit(1)
}
