import * as structure from "./structure.js"
import { mapEntryPairs } from "./converters/1_6_map.js"
import { listItemNodes } from "./converters/1_5_list.js"
import { referencePathKeyNodes } from "./converters/1_7_reference.js"

//
// dispatcher
//
export const jsOf = ({node, root, stack})=>{
    if (node == null) {
        return null
    }
    const toJsifier = structure.toJsifiers[node.toStringifier]
    if (!toJsifier) {
        throw Error(`I don't know how to convert a ${node.toStringifier} node into a JS value`)
    }
    return toJsifier({node, root, stack, jsOf})
}

/**
 * one-way convert a node tree (or XData string) into plain JS values
 * comments/formatting are dropped, references are resolved, strings are interpolated
 */
export const toJs = (nodeOrString)=>{
    const node = typeof nodeOrString == 'string' ? structure.toNode(nodeOrString) : nodeOrString
    return jsOf({node, root: node, stack: []})
}

//
// scalars
//
const specialValueToJs = (content)=>{
    const lowered = content.toLowerCase()
    if (lowered == "true") { return true }
    if (lowered == "false") { return false }
    if (lowered == "nan") { return NaN }
    if (lowered == "undefined") { return undefined }
    if (lowered == "infinity" || lowered == "infinite") { return Infinity }
    if (lowered == "-infinity" || lowered == "-infinite") { return -Infinity }
    // null, nil, none, nullptr
    return null
}

structure.RegisterToJsifier({
    SpecialValue: ({node})=>specialValueToJs(node.childComponents.content),
    Number: ({node})=>Number(node.childComponents.content),
    Atom: ({node})=>Symbol.for(node.childComponents.content),
})

//
// reference resolution
//
const rootValueNode = (root)=>{
    return root.toStringifier == "Document" ? root.childComponents.value : root
}

const unwrapped = (node)=>{
    while (node instanceof Object && (node.toStringifier == "NextLineValue" || node.toStringifier == "OwnLineScalar")) {
        node = node.childComponents.value
    }
    return node
}

// follows the path of a Reference node and returns the target *node*
export const resolveReferenceNode = ({node, root, stack})=>{
    if (stack.includes(node)) {
        throw Error(`Circular reference detected: ${structure.toString({node, context: new structure.Context({})})}`)
    }
    const innerStack = [...stack, node]
    const pathValues = referencePathKeyNodes(node).map(eachKeyNode=>jsOf({node: eachKeyNode, root, stack: innerStack}))
    let target = unwrapped(rootValueNode(root))
    for (const eachPathValue of pathValues) {
        if (target == null) {
            throw Error(`Reference path ${JSON.stringify(String(eachPathValue))} points into nothing`)
        }
        if (target.toStringifier == "Map" || target.toStringifier == "BlockMap") {
            const pairs = mapEntryPairs(target)
            let found = null
            for (const {keyNode, valueNode} of pairs) {
                const keyValue = jsOf({node: keyNode, root, stack: innerStack})
                if (keyValue === eachPathValue || (typeof keyValue == 'number' && typeof eachPathValue == 'number' && Number.isNaN(keyValue) && Number.isNaN(eachPathValue))) {
                    found = valueNode
                    break
                }
            }
            if (found == null) {
                throw Error(`Reference path segment ${JSON.stringify(String(eachPathValue))} wasn't found in the map`)
            }
            target = unwrapped(found)
        } else if (target.toStringifier == "List" || target.toStringifier == "BlockList") {
            if (typeof eachPathValue != 'number') {
                throw Error(`Reference path segment ${JSON.stringify(String(eachPathValue))} needs to be a number to index a list`)
            }
            const items = listItemNodes(target)
            if (eachPathValue < 0 || eachPathValue >= items.length) {
                throw Error(`Reference index ${eachPathValue} is out of range (list has ${items.length} items)`)
            }
            target = unwrapped(items[eachPathValue])
        } else {
            throw Error(`Reference path segment ${JSON.stringify(String(eachPathValue))} tried to index into a ${target.toStringifier}, which isn't a map or list`)
        }
    }
    return { targetNode: target, innerStack }
}

structure.RegisterToJsifier({
    Reference: ({node, root, stack})=>{
        const { targetNode, innerStack } = resolveReferenceNode({node, root, stack})
        return jsOf({node: targetNode, root, stack: innerStack})
    },
})
