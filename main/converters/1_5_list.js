import * as structure from "../structure.js"
import { ParserError, ContextIds } from "../structure.js"
import * as tools from "../xdata_tools.js"
import * as utils from "../utils.js"

import { adjectivesPrefixToNode } from "./0_1_adjectives.js"

// inline list: [ value, value, ... ]  (also handles empty [])
export const listToNode = ({remaining, context})=>{
    const childComponents = {
        adjectivesPrefix: null, // token
        preWhitespace: null, // string
        openingBracket: null, // string
        content: [], // value nodes, "," strings, and a possible final whitespace string
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

    var { remaining, extraction, context } = tools.extract({ pattern: /^\[/, from: remaining, context })
    childComponents.openingBracket = extraction

    const inlineContext = new structure.Context({ parentContext: context, id: ContextIds.inlineValue })
    const content = []
    while (true) {
        try {
            var { remaining, extraction, context } = tools.extract({ pattern: structure.toNodeifiers.InlineValue, from: remaining, context: inlineContext })
            content.push(extraction)
        } catch (error) {
            if (!(error instanceof ParserError)) {
                throw error
            }
            break
        }
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
    // whitespace before the closing bracket (empty list, or after a trailing comma)
    var { remaining, extraction, context } = tools.extract({ pattern: /^ */, from: remaining, context })
    if (extraction.length > 0) {
        content.push(extraction)
    }
    childComponents.content = content

    var { remaining, extraction, context } = tools.extract({ pattern: /^\]/, from: remaining, context })
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
        toStringifier: "List",
        childComponents,
        formattingPreferences: {},
    })
}

export const listItemNodes = (listNode)=>{
    const components = listNode.childComponents
    if (components.content instanceof Array) {
        // inline list
        return components.content.filter(each=>each instanceof Object)
    }
    // block list
    return components.entries.filter(each=>each instanceof Object && each.toStringifier == "ListEntry").map(each=>each.childComponents.value)
}

structure.RegisterConverter({
    toNode: {
        List: listToNode,
    },
    toString: {
        List: ({node, context})=>{
            if (context.id == ContextIds.mapKey || context.id == ContextIds.referencePath) {
                node = {...node}
                node.childComponents = {...node.childComponents}
                node.childComponents.comment = null
            }
            return structure.childComponentsToString({node, context})
        },
    },
    toJs: {
        List: ({node, jsOf, root, stack})=>{
            return listItemNodes(node).map(each=>jsOf({node: each, root, stack}))
        },
    },
})
