import * as structure from "../structure.js"
import { ParserError, ContextIds } from "../structure.js"
import * as tools from "../xdata_tools.js"
import * as utils from "../utils.js"

import { adjectivesPrefixToNode } from "./0_1_adjectives.js"

// inline map: { key: value, key: value }  (also handles empty {})
export const mapToNode = ({remaining, context})=>{
    const childComponents = {
        adjectivesPrefix: null, // token
        preWhitespace: null, // string
        openingBracket: null, // string
        content: [], // key nodes, ":" strings, value nodes, "," strings, possible final whitespace
        closingBracket: null, // string
        postWhitespace: null, // string
        comment: null, // node
    }

    try {
        var { remaining, extraction, context } = tools.extract({ pattern: adjectivesPrefixToNode, from: remaining, context })
        childComponents.adjectivesPrefix = extraction
    } catch (error) {
        if (!(error instanceof ParserError)) {
            throw error
        }
    }

    var { remaining, extraction, context } = tools.extract({ pattern: /^ */, from: remaining, context })
    childComponents.preWhitespace = extraction

    var { remaining, extraction, context } = tools.extract({ pattern: /^\{/, from: remaining, context })
    childComponents.openingBracket = extraction

    const keyContext = new structure.Context({ parentContext: context, id: ContextIds.mapKey })
    const inlineContext = new structure.Context({ parentContext: context, id: ContextIds.inlineValue })
    const content = []
    while (true) {
        try {
            var { remaining, extraction, context } = tools.extract({ pattern: structure.toNodeifiers.Key, from: remaining, context: keyContext })
            content.push(extraction)
        } catch (error) {
            if (!(error instanceof ParserError)) {
                throw error
            }
            break
        }
        var { remaining, extraction, context } = tools.extract({ pattern: /^:/, from: remaining, context })
        content.push(extraction)
        var { remaining, extraction, context } = tools.extract({ pattern: structure.toNodeifiers.InlineValue, from: remaining, context: inlineContext })
        content.push(extraction)
        try {
            var { remaining, extraction, context } = tools.extract({ pattern: /^,/, from: remaining, context })
            content.push(extraction)
        } catch (error) {
            if (!(error instanceof ParserError)) {
                throw error
            }
            break
        }
    }
    // whitespace before the closing bracket (empty map, or after a trailing comma)
    var { remaining, extraction, context } = tools.extract({ pattern: /^ */, from: remaining, context })
    if (extraction.length > 0) {
        content.push(extraction)
    }
    childComponents.content = content

    var { remaining, extraction, context } = tools.extract({ pattern: /^\}/, from: remaining, context })
    childComponents.closingBracket = extraction

    var { remaining, extraction, context } = tools.extract({ pattern: /^ */, from: remaining, context })
    childComponents.postWhitespace = extraction

    if (context.id != ContextIds.mapKey && context.id != ContextIds.referencePath) {
        try {
            childComponents.comment = structure.toNodeifiers.Comment({ remaining, context })
        } catch (error) {
            if (!(error instanceof structure.ParserError)) {
                throw error
            }
        }
    }

    return new structure.Node({
        toStringifier: "Map",
        childComponents,
        formattingPreferences: {},
    })
}

// [{keyNode, valueNode, entryNode}] for both inline maps and block maps
export const mapEntryPairs = (mapNode)=>{
    const components = mapNode.childComponents
    if (components.content instanceof Array) {
        // inline map: content = [key, ":", value, ",", key, ":", value, ...]
        const nodes = components.content.filter(each=>each instanceof Object)
        const pairs = []
        for (let index = 0; index+1 < nodes.length; index += 2) {
            pairs.push({ keyNode: nodes[index], valueNode: nodes[index+1], entryNode: null })
        }
        return pairs
    }
    // block map
    return components.entries.filter(
        each=>each instanceof Object && each.toStringifier == "MapEntry"
    ).map(
        each=>({ keyNode: each.childComponents.key, valueNode: each.childComponents.value, entryNode: each })
    )
}

export const mapNodeToJs = ({node, jsOf, root, stack})=>{
    const pairs = mapEntryPairs(node).map(({keyNode, valueNode})=>[
        jsOf({node: keyNode, root, stack}),
        jsOf({node: valueNode, root, stack}),
    ])
    const allKeysAreObjectSafe = pairs.every(([key])=>typeof key == 'string' || typeof key == 'symbol')
    if (allKeysAreObjectSafe) {
        return Object.fromEntries(pairs)
    }
    return new Map(pairs)
}

structure.RegisterConverter({
    toNode: {
        Map: mapToNode,
    },
    toString: {
        Map: ({node, context})=>{
            if (context.id == ContextIds.mapKey || context.id == ContextIds.referencePath) {
                node = {...node}
                node.childComponents = {...node.childComponents}
                node.childComponents.comment = null
            }
            return structure.childComponentsToString({node, context})
        },
    },
    toJs: {
        Map: mapNodeToJs,
    },
})
