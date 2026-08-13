import * as structure from "../structure.js"
import { ParserError, ContextIds } from "../structure.js"
import * as tools from "../xdata_tools.js"
import * as utils from "../utils.js"

// NOTE: converters are looked up through structure.toNodeifiers at call time
//       (rather than imported) because the value types are inherently circular

//
// bareword map keys, e.g.   name: 10
//
export const barewordToNode = ({remaining, context})=>{
    const childComponents = {
        preWhitespace: null, // string
        content: null, // string
        postWhitespace: null, // string
    }
    var { remaining, extraction, context } = tools.extract({ pattern: /^ */, from: remaining, context })
    childComponents.preWhitespace = extraction
    var { remaining, extraction, context } = tools.extract({ pattern: /^[a-zA-Z_][a-zA-Z_0-9]*/, from: remaining, context })
    childComponents.content = extraction
    var { remaining, extraction, context } = tools.extract({ pattern: /^ */, from: remaining, context })
    childComponents.postWhitespace = extraction
    return new structure.Node({
        toStringifier: "Bareword",
        childComponents,
        formattingPreferences: {},
    })
}

//
// any value that fits on one line
//
export const inlineValueToNode = ({remaining, context})=>{
    const inlineContext = context.id == ContextIds.inlineValue
        ? context
        : new structure.Context({ parentContext: context, id: ContextIds.inlineValue })

    var { remaining, extraction, context } = tools.extract({
        oneOf: [
            structure.toNodeifiers.SpecialValue,
            structure.toNodeifiers.Number,
            structure.toNodeifiers.Atom,
            structure.toNodeifiers.SystemCharacter,
            structure.toNodeifiers.Reference,
            structure.toNodeifiers.String,
            structure.toNodeifiers.List,
            structure.toNodeifiers.Map,
        ],
        from: remaining,
        context: inlineContext,
    })

    return extraction
}

//
// map keys / reference-path segments
//
export const keyToNode = ({remaining, context})=>{
    const keyContext = (context.id == ContextIds.mapKey || context.id == ContextIds.referencePath)
        ? context
        : new structure.Context({ parentContext: context, id: ContextIds.mapKey })

    var { remaining, extraction, context } = tools.extract({
        oneOf: [
            structure.toNodeifiers.SpecialValue,
            structure.toNodeifiers.Number,
            structure.toNodeifiers.Atom,
            structure.toNodeifiers.SystemCharacter,
            structure.toNodeifiers.Reference,
            structure.toNodeifiers.String,
            barewordToNode,
        ],
        from: remaining,
        context: keyContext,
    })

    return extraction
}

structure.RegisterConverter({
    toNode: {
        InlineValue: inlineValueToNode,
        Key: keyToNode,
        Bareword: barewordToNode,
    },
    toString: {
        Bareword: ({node, context})=>structure.childComponentsToString({node, context}),
    },
    toJs: {
        Bareword: ({node})=>node.childComponents.content,
    },
})
