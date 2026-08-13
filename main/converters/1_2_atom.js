import * as structure from "../structure.js"
import { ParserError, ContextIds }   from "../structure.js"
import * as tools from "../xdata_tools.js"
import * as utils from "../utils.js"

import { adjectivesPrefixToNode } from "./0_1_adjectives.js"

export const atomToNode = ({remaining, context})=>{
    //
    // adjectivesPrefix
    //
    var adjectivesPrefix = null
    try {
        var { remaining, extraction, context } = tools.extract({ pattern: adjectivesPrefixToNode, from: remaining, context })
        adjectivesPrefix = extraction
    } catch (error) {
        if (!(error instanceof ParserError)) {
            throw error
        }
    }

    return atomWithAtSymbolToNode({ remaining, context, adjectivesPrefix })
}

export const atomWithAtSymbolToNode = ({remaining, context, adjectivesPrefix=null})=>{
    const childComponents = {
        adjectivesPrefix, // token
        preWhitespace: null, // token
        symbol: null, // token
        content: null, // token
        postWhitespace: null, // token
        comment: null, // node
    }

    // 
    // preWhitespace
    // 
    var { remaining, extraction, context } = tools.extract({ pattern: /^ */, from: remaining, context })
    childComponents.preWhitespace = extraction
    
    // 
    // @-symbol itself
    // 
    var { remaining, extraction, context } = tools.extract({ pattern: /^@/i, from: remaining, context })
    childComponents.symbol = extraction

    // 
    // content
    // 
    var { remaining, extraction, context } = tools.extract({ pattern: /^-?[a-zA-Z_][a-zA-Z_0-9]*/, from: remaining, context })
    childComponents.content = extraction
    
    // 
    // postWhitespace
    // 
    var { remaining, extraction, context } = tools.extract({ pattern: /^ */, from: remaining, context })
    childComponents.postWhitespace = extraction
    
    // 
    // comment is optional
    // 
    try {
        childComponents.comment = structure.toNodeifiers.Comment({ remaining, context })
    } catch (error) {
        // only catch parse errors
        if (!(error instanceof structure.ParserError)) {
            throw error
        }
    }

    // 
    // return
    // 
    return new structure.Node({
        toStringifier: "Atom",
        childComponents,
        formattingPreferences: {},
    })
}

structure.RegisterConverter({
    toNode: {
        Atom: atomToNode,
    },
    toString: {
        Atom: ({node, context})=>{
            // remove the comment if in a place where the comment isn't allowed
            if (context.id == ContextIds.mapKey || context.id == ContextIds.referencePath) {
                node = {...node}
                node.childComponents = {...node.childComponents}
                node.childComponents.comment = null
            }

            return structure.childComponentsToString({node, context})
        },
    },
})