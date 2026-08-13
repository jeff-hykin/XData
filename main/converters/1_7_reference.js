import * as structure from "../structure.js"
import { ParserError, ContextIds } from "../structure.js"
import * as tools from "../xdata_tools.js"

// #valueOf[key1, key2, ...]
export const referenceToNode = ({remaining, context})=>{
    const childComponents = {
        preWhitespace: null, // string
        symbol: null, // string "#valueOf"
        openingBracket: null, // string
        path: [], // alternating key nodes and "," strings (whitespace lives inside key nodes)
        closingBracket: null, // string
        postWhitespace: null, // string
        comment: null, // node
    }

    var { remaining, extraction, context } = tools.extract({ pattern: /^ */, from: remaining, context })
    childComponents.preWhitespace = extraction

    var { remaining, extraction, context } = tools.extract({ pattern: /^#valueOf/, from: remaining, context })
    childComponents.symbol = extraction

    var { remaining, extraction, context } = tools.extract({ pattern: /^\[/, from: remaining, context })
    childComponents.openingBracket = extraction

    const pathContext = new structure.Context({ parentContext: context, id: ContextIds.referencePath })
    const path = []
    // at least one key
    var { remaining, extraction, context } = tools.extract({ pattern: structure.toNodeifiers.Key, from: remaining, context: pathContext })
    path.push(extraction)
    while (true) {
        try {
            var { remaining, extraction, context } = tools.extract({ pattern: /^,/, from: remaining, context })
            path.push(extraction)
        } catch (error) {
            if (!(error instanceof ParserError)) {
                throw error
            }
            break
        }
        var { remaining, extraction, context } = tools.extract({ pattern: structure.toNodeifiers.Key, from: remaining, context: pathContext })
        path.push(extraction)
    }
    childComponents.path = path

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
        toStringifier: "Reference",
        childComponents,
        formattingPreferences: {},
    })
}

// the key nodes within .path (commas excluded)
export const referencePathKeyNodes = (referenceNode)=>{
    return referenceNode.childComponents.path.filter(each=>each instanceof Object)
}

structure.RegisterConverter({
    toNode: {
        Reference: referenceToNode,
    },
    toString: {
        Reference: ({node, context})=>{
            if (context.id == ContextIds.mapKey || context.id == ContextIds.referencePath) {
                node = {...node}
                node.childComponents = {...node.childComponents}
                node.childComponents.comment = null
            }
            return structure.childComponentsToString({node, context})
        },
    },
})
