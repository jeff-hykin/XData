import * as structure from "../structure.js"
import { ParserError, ContextIds } from "../structure.js"
import * as tools from "../xdata_tools.js"

export const systemCharacterToNode = ({remaining, context})=>{
    const childComponents = {
        preWhitespace: null, // string
        content: null, // string, e.g. "#tab" or "#unicode[1F600]"
        postWhitespace: null, // string
    }

    var { remaining, extraction, context } = tools.extract({ pattern: /^ */, from: remaining, context })
    childComponents.preWhitespace = extraction

    var { remaining, extraction, context } = tools.extract({
        pattern: /^#(tab|newline|unicode\[[0-9a-fA-F]+\]|ascii\[\d+\])/,
        from: remaining,
        context,
    })
    childComponents.content = extraction

    var { remaining, extraction, context } = tools.extract({ pattern: /^ */, from: remaining, context })
    childComponents.postWhitespace = extraction

    return new structure.Node({
        toStringifier: "SystemCharacter",
        childComponents,
        formattingPreferences: {},
    })
}

export const systemCharacterToChar = (node)=>{
    const content = node.childComponents.content
    if (content == "#tab") {
        return "\t"
    }
    if (content == "#newline") {
        return "\n"
    }
    var match = content.match(/^#unicode\[([0-9a-fA-F]+)\]$/)
    if (match) {
        return String.fromCodePoint(parseInt(match[1], 16))
    }
    var match = content.match(/^#ascii\[(\d+)\]$/)
    if (match) {
        return String.fromCharCode(parseInt(match[1], 10))
    }
    throw Error(`Unknown system character: ${content}`)
}

structure.RegisterConverter({
    toNode: {
        SystemCharacter: systemCharacterToNode,
    },
    toString: {
        SystemCharacter: ({node, context})=>structure.childComponentsToString({node, context}),
    },
    toJs: {
        SystemCharacter: ({node})=>systemCharacterToChar(node),
    },
})
