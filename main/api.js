import * as structure from "./structure.js"
import { ContextIds } from "./structure.js"
import { jsOf, toJs } from "./to_js.js"
import { mapEntryPairs } from "./converters/1_6_map.js"
import { listItemNodes } from "./converters/1_5_list.js"
import { inlineValueToNode, keyToNode } from "./converters/values.js"
import { mapEntryToNode, listEntryToNode } from "./converters/2_0_block.js"
import { minimumViableQuoteSize } from "./converters/1_4_string.js"

//
// parse / stringify
//
export const parse = (string)=>structure.toNode(string)
export const stringify = (node)=>structure.toString({node, context: new structure.Context({})})
export { toJs }

//
// js value => XData text / node
//
export const jsToXdataText = (value)=>{
    if (value === null) { return "null" }
    if (value === undefined) { return "undefined" }
    if (typeof value == 'boolean') { return `${value}` }
    if (typeof value == 'number') {
        if (Number.isNaN(value)) { return "NaN" }
        if (value === Infinity) { return "infinity" }
        if (value === -Infinity) { return "-infinity" }
        return `${value}`
    }
    if (typeof value == 'symbol') {
        const name = Symbol.keyFor(value)
        if (name == null) {
            throw Error(`Only Symbol.for() symbols can become atoms`)
        }
        return `@${name}`
    }
    if (typeof value == 'string') {
        if (value.includes("\n")) {
            throw Error(`Strings with newlines can't be created inline (yet); insert a block string manually`)
        }
        const quotes = `"`.repeat(minimumViableQuoteSize(value, `"`))
        return `${quotes}${value}${quotes}`
    }
    if (value instanceof Array) {
        return `[${value.map(jsToXdataText).join(", ")}]`
    }
    if (value instanceof Map || value instanceof Object) {
        const pairs = value instanceof Map ? [...value.entries()] : Object.entries(value)
        return `{ ${pairs.map(([eachKey, eachValue])=>`${keyToXdataText(eachKey)}: ${jsToXdataText(eachValue)}`).join(", ")} }`
    }
    throw Error(`I don't know how to turn ${String(value)} into XData`)
}

const keyToXdataText = (key)=>{
    if (typeof key == 'string' && key.match(/^[a-zA-Z_][a-zA-Z_0-9]*$/)) {
        return key
    }
    return jsToXdataText(key)
}

export const jsToNode = (value)=>{
    return inlineValueToNode({ remaining: jsToXdataText(value), context: new structure.Context({}) })
}

//
// navigation
//
const containerOf = (node)=>{
    while (node instanceof Object && ["Document", "NextLineValue", "OwnLineScalar"].includes(node.toStringifier)) {
        node = node.childComponents.value
    }
    return node
}

const isMapNode = (node)=>node instanceof Object && (node.toStringifier == "Map" || node.toStringifier == "BlockMap")
const isListNode = (node)=>node instanceof Object && (node.toStringifier == "List" || node.toStringifier == "BlockList")

const keyOfPairMatches = (pairKeyNode, key)=>{
    const keyValue = jsOf({node: pairKeyNode, root: null, stack: []})
    return keyValue === key
}

/**
 * walk a path of map keys / list indices and return the value node (still wrapped, for editing)
 */
export const getNode = (rootNode, path)=>{
    let node = rootNode
    for (const eachKey of path) {
        const container = containerOf(node)
        if (isMapNode(container)) {
            const pair = mapEntryPairs(container).find(({keyNode})=>keyOfPairMatches(keyNode, eachKey))
            if (!pair) {
                throw Error(`Key ${String(eachKey)} wasn't found`)
            }
            node = pair.valueNode
        } else if (isListNode(container)) {
            node = listItemNodes(container)[eachKey]
            if (node == null) {
                throw Error(`Index ${eachKey} wasn't found`)
            }
        } else {
            throw Error(`Can't index into a ${container?.toStringifier}`)
        }
    }
    return node
}

//
// mutation
//
const blockEntryIndent = (blockNode)=>{
    const firstEntry = blockNode.childComponents.entries.find(each=>each.toStringifier == "MapEntry" || each.toStringifier == "ListEntry")
    return firstEntry ? firstEntry.childComponents.indent : ""
}

const ensureLastEntryHasNewline = (blockNode)=>{
    const entries = blockNode.childComponents.entries
    const last = entries[entries.length-1]
    if (!last || stringify(last).endsWith("\n")) {
        return
    }
    // put the newline on the innermost line, not after a whole nested block
    const inner = last.childComponents.value && containerOf(last.childComponents.value)
    if (inner instanceof Object && inner.childComponents.entries) {
        ensureLastEntryHasNewline(inner)
    } else {
        last.childComponents.newline = "\n"
    }
}

/**
 * set (or add) a key in a map node; value can be a JS value or an already-built node
 */
export const setKey = (mapishNode, key, value)=>{
    const container = containerOf(mapishNode)
    if (!isMapNode(container)) {
        throw Error(`setKey needs a map node, got ${container?.toStringifier}`)
    }
    const valueNode = value instanceof structure.Node ? value : jsToNode(value)
    const existing = mapEntryPairs(container).find(({keyNode})=>keyOfPairMatches(keyNode, key))
    if (existing) {
        // preserve the spacing that sat in front of the old value
        const oldPre = containerOf(existing.valueNode)?.childComponents?.preWhitespace
        valueNode.childComponents.preWhitespace = typeof oldPre == 'string' && oldPre.length > 0 ? oldPre : " "
        if (existing.entryNode) {
            existing.entryNode.childComponents.value = valueNode
        } else {
            // inline map: swap within the content array
            const content = container.childComponents.content
            content[content.indexOf(existing.valueNode)] = valueNode
        }
        return valueNode
    }
    // add a brand new entry
    if (container.toStringifier == "BlockMap") {
        ensureLastEntryHasNewline(container)
        const indent = blockEntryIndent(container)
        const entry = mapEntryToNode({
            remaining: `${indent}${keyToXdataText(key)}: ${jsToXdataText(value instanceof structure.Node ? toJs(value) : value)}\n`,
            context: new structure.Context({ id: ContextIds.block, indent }),
        })
        container.childComponents.entries.push(entry)
        return entry.childComponents.value
    }
    // inline map
    const content = container.childComponents.content
    if (content.filter(each=>each instanceof Object).length > 0) {
        content.push(",")
    }
    const keyNode = keyToNode({ remaining: ` ${keyToXdataText(key)}`, context: new structure.Context({ id: ContextIds.mapKey }) })
    valueNode.childComponents.preWhitespace = " "
    content.push(keyNode, ":", valueNode)
    return valueNode
}

/**
 * append a value to a list node; value can be a JS value or an already-built node
 */
export const push = (listishNode, value)=>{
    const container = containerOf(listishNode)
    if (!isListNode(container)) {
        throw Error(`push needs a list node, got ${container?.toStringifier}`)
    }
    if (container.toStringifier == "BlockList") {
        ensureLastEntryHasNewline(container)
        const indent = blockEntryIndent(container)
        const entry = listEntryToNode({
            remaining: `${indent}- ${jsToXdataText(value instanceof structure.Node ? toJs(value) : value)}\n`,
            context: new structure.Context({ id: ContextIds.block, indent }),
        })
        container.childComponents.entries.push(entry)
        return entry.childComponents.value
    }
    // inline list
    const content = container.childComponents.content
    const valueNode = value instanceof structure.Node ? value : jsToNode(value)
    if (content.filter(each=>each instanceof Object).length > 0) {
        content.push(",")
        valueNode.childComponents.preWhitespace = " "
    }
    content.push(valueNode)
    return valueNode
}

/**
 * insert a whole-line comment into a block map/list (or a document)
 * index counts entries-array positions; default is the end
 */
export const addComment = (node, text, {index=null}={})=>{
    const container = containerOf(node)
    if (isMapNode(container) || isListNode(container)) {
        if (container.childComponents.entries == null) {
            throw Error(`addComment only works on block (indented) maps/lists, not inline ones`)
        }
        const indent = blockEntryIndent(container)
        const comment = structure.toNodeifiers.Comment({ remaining: `${indent}# ${text}\n`, context: new structure.Context({}) })
        const entries = container.childComponents.entries
        if (index == null) {
            ensureLastEntryHasNewline(container)
            entries.push(comment)
        } else {
            entries.splice(index, 0, comment)
        }
        return comment
    }
    if (node.toStringifier == "Document") {
        const comment = structure.toNodeifiers.Comment({ remaining: `# ${text}\n`, context: new structure.Context({}) })
        node.childComponents.trailingCommentsAndLines.push(comment)
        return comment
    }
    throw Error(`addComment needs a block map/list or document, got ${node.toStringifier}`)
}
