import * as structure from "../structure.js"
import { ParserError, ContextIds } from "../structure.js"
import * as tools from "../xdata_tools.js"
import * as utils from "../utils.js"
import "./0_0_non_values.js"
import "./1_0_system_character.js"
import { regex, escapeRegexMatch, findAll } from "https://esm.sh/gh/jeff-hykin/good-js@1.5.0.0/source/string.js"

import { adjectivesPrefixToNode } from "./0_1_adjectives.js"

//
// helpers
//
    export const extractStartingQuote = ({from, context, quote}) => {
        let totalCount = 0
        let startSize = 1
        while (from[totalCount] == quote) {
            totalCount += 1
            if (totalCount >= startSize*3) {
                startSize = startSize*3
            }
        }
        if (totalCount == 0) {
            throw new structure.ParserError({ message: `cant extract starting quote from: ${from}`, context })
        }

        return tools.extract({
            pattern: regex`^${from.slice(0, startSize)}`,
            from,
            context,
        })
    }

    export const minimumViableQuoteSize = (stringContent, quote) => {
        if (stringContent == null || quote == null) {
            return null
        }
        let quotes = findAll(new RegExp(`${quote}+`), stringContent)
        let maxQuoteSize = Math.max(0, ...quotes.map(each=>each[0].length))
        let minViableQuoteSize = 1
        if (maxQuoteSize > 0) {
            let logBase = 3
            let logOfSizeBaseThree = Math.log(maxQuoteSize+1) / Math.log(logBase)
            let closestLargerPowerOfThree = Math.ceil(logOfSizeBaseThree)
            minViableQuoteSize = 3**closestLargerPowerOfThree
        }
        return minViableQuoteSize
    }

    const extractPrefix = ({remaining, context}) => {
        var adjectivesPrefix = null
        try {
            var { remaining, extraction, context } = tools.extract({ pattern: adjectivesPrefixToNode, from: remaining, context })
            adjectivesPrefix = extraction
        } catch (error) {
            if (!(error instanceof ParserError)) {
                throw error
            }
        }
        var { remaining, extraction, context } = tools.extract({ pattern: /^ */, from: remaining, context })
        return { remaining, context, adjectivesPrefix, preWhitespace: extraction }
    }

    const extractOptionalComment = ({remaining, context, childComponents}) => {
        if (context.id != ContextIds.mapKey && context.id != ContextIds.referencePath) {
            try {
                childComponents.comment = structure.toNodeifiers.Comment({ remaining, context })
            } catch (error) {
                if (!(error instanceof structure.ParserError)) {
                    throw error
                }
            }
        }
    }

//
// escape sections (for figurative strings): {#tab} or {#valueOf[key]}
//
    export const escapeSectionToNode = ({remaining, context})=>{
        const childComponents = {
            openingBrace: null, // string
            content: null, // SystemCharacter or Reference node
            closingBrace: null, // string
        }

        var { remaining, extraction, context } = tools.extract({ pattern: /^\{/, from: remaining, context })
        childComponents.openingBrace = extraction

        var { remaining, extraction, context } = tools.extract({
            oneOf: [
                structure.toNodeifiers.SystemCharacter,
                structure.toNodeifiers.Reference,
            ],
            from: remaining,
            context,
        })
        childComponents.content = extraction

        var { remaining, extraction, context } = tools.extract({ pattern: /^\}/, from: remaining, context })
        childComponents.closingBrace = extraction

        return new structure.Node({
            toStringifier: "EscapeSection",
            childComponents,
            formattingPreferences: {},
        })
    }

    // turns raw figurative-string content into [string, EscapeSectionNode, string, ...]
    export const contentToSegments = ({content, context}) => {
        const segments = []
        var remaining = content
        while (remaining.length > 0) {
            const textMatch = remaining.match(/^[^{]+/)
            if (textMatch) {
                segments.push(textMatch[0])
                remaining = remaining.slice(textMatch[0].length)
            } else {
                var { remaining, extraction, context } = tools.extract({ pattern: escapeSectionToNode, from: remaining, context })
                segments.push(extraction)
            }
        }
        return { segments, context }
    }

//
// generic quoted-extraction helpers
//
    // inline: opening quote run, lazy scan to earliest closing run on the same line
    const extractInlineQuoted = ({remaining, context, quote}) => {
        var { remaining, extraction, context } = extractStartingQuote({ quote, from: remaining, context })
        const openingQuote = extraction
        const quotePattern = escapeRegexMatch(openingQuote)
        var { remaining, extraction, context } = tools.extract({
            pattern: new RegExp(`^[^\\n]*?${quotePattern}(?!${escapeRegexMatch(quote)})`),
            from: remaining,
            context,
        })
        return {
            remaining,
            context,
            openingQuote,
            content: extraction.slice(0, -openingQuote.length),
            closingQuote: openingQuote,
        }
    }

    // block: opening quote run, spaces, newline, raw lines, then indent + closing run on its own line
    const extractBlockQuoted = ({remaining, context, quote}) => {
        var { remaining, extraction, context } = extractStartingQuote({ quote, from: remaining, context })
        const openingQuote = extraction
        var { remaining, extraction, context } = tools.extract({ pattern: /^ *\n/, from: remaining, context })
        const openingTrail = extraction

        const quotePattern = escapeRegexMatch(openingQuote)
        const boundary = remaining.match(new RegExp(`^([\\s\\S]*?)(^[ \\t]*)${quotePattern}(?!${escapeRegexMatch(quote)})`, "m"))
        if (!boundary || boundary.index != 0) {
            throw new structure.ParserError({ message: `cant find closing ${openingQuote} for block string`, context })
        }
        const rawContent = boundary[1]
        const closingIndent = boundary[2]
        var { remaining, extraction, context } = tools.extract({ pattern: new RegExp(`^[\\s\\S]{${rawContent.length + closingIndent.length}}${quotePattern}`), from: remaining, context })
        return {
            remaining,
            context,
            openingQuote,
            openingTrail,
            rawContent, // every content line, each ending with \n
            closingIndent,
            closingQuote: openingQuote,
        }
    }

//
// string => stringNode
//
    export const inlineStringLiteralToNode = ({remaining, context})=>{
        var { remaining, context, adjectivesPrefix, preWhitespace } = extractPrefix({remaining, context})
        var { remaining, context, openingQuote, content, closingQuote } = extractInlineQuoted({ remaining, context, quote: `"` })
        const childComponents = {
            adjectivesPrefix,
            preWhitespace,
            openingQuote,
            content,
            closingQuote,
            postWhitespace: null,
            comment: null,
        }
        var { remaining, extraction, context } = tools.extract({ pattern: /^ */, from: remaining, context })
        childComponents.postWhitespace = extraction
        extractOptionalComment({remaining, context, childComponents})
        return new structure.Node({
            toStringifier: "String",
            childComponents,
            formattingPreferences: {},
        })
    }

    export const inlineFigurativeStringToNode = ({remaining, context})=>{
        var { remaining, context, adjectivesPrefix, preWhitespace } = extractPrefix({remaining, context})
        var { remaining, context, openingQuote, content, closingQuote } = extractInlineQuoted({ remaining, context, quote: `'` })
        var { segments } = contentToSegments({ content, context })
        const childComponents = {
            adjectivesPrefix,
            preWhitespace,
            openingQuote,
            content: segments,
            closingQuote,
            postWhitespace: null,
            comment: null,
        }
        var { remaining, extraction, context } = tools.extract({ pattern: /^ */, from: remaining, context })
        childComponents.postWhitespace = extraction
        extractOptionalComment({remaining, context, childComponents})
        return new structure.Node({
            toStringifier: "FigurativeString",
            childComponents,
            formattingPreferences: {},
        })
    }

    export const blockStringLiteralToNode = ({remaining, context})=>{
        var { remaining, context, adjectivesPrefix, preWhitespace } = extractPrefix({remaining, context})
        var { remaining, context, openingQuote, openingTrail, rawContent, closingIndent, closingQuote } = extractBlockQuoted({ remaining, context, quote: `"` })
        const childComponents = {
            adjectivesPrefix,
            preWhitespace,
            openingQuote,
            openingTrail,
            content: rawContent,
            closingIndent,
            closingQuote,
            postWhitespace: null,
            comment: null,
        }
        var { remaining, extraction, context } = tools.extract({ pattern: /^ */, from: remaining, context })
        childComponents.postWhitespace = extraction
        extractOptionalComment({remaining, context, childComponents})
        return new structure.Node({
            toStringifier: "BlockString",
            childComponents,
            formattingPreferences: {},
        })
    }

    export const blockFigurativeStringToNode = ({remaining, context})=>{
        var { remaining, context, adjectivesPrefix, preWhitespace } = extractPrefix({remaining, context})
        var { remaining, context, openingQuote, openingTrail, rawContent, closingIndent, closingQuote } = extractBlockQuoted({ remaining, context, quote: `'` })
        var { segments } = contentToSegments({ content: rawContent, context })
        const childComponents = {
            adjectivesPrefix,
            preWhitespace,
            openingQuote,
            openingTrail,
            content: segments,
            closingIndent,
            closingQuote,
            postWhitespace: null,
            comment: null,
        }
        var { remaining, extraction, context } = tools.extract({ pattern: /^ */, from: remaining, context })
        childComponents.postWhitespace = extraction
        extractOptionalComment({remaining, context, childComponents})
        return new structure.Node({
            toStringifier: "BlockFigurativeString",
            childComponents,
            formattingPreferences: {},
        })
    }

    export const stringToNode = ({remaining, context})=>{
        const inKey = context.id == ContextIds.mapKey || context.id == ContextIds.referencePath
        var { remaining, extraction, context } = tools.extract({
            oneOf: inKey
                ? [inlineStringLiteralToNode, inlineFigurativeStringToNode]
                : [blockStringLiteralToNode, blockFigurativeStringToNode, inlineStringLiteralToNode, inlineFigurativeStringToNode],
            from: remaining,
            context,
        })
        return extraction
    }

//
// stringNode => string
//
    const withoutComments = (node, context) => {
        if (context.id == ContextIds.mapKey || context.id == ContextIds.referencePath) {
            node = {...node}
            node.childComponents = {...node.childComponents}
            node.childComponents.comment = null
        }
        return node
    }

    // if content changed and the old quotes can no longer contain it, escalate them
    const repairedQuotes = (node, quote) => {
        const content = node.childComponents.content
        const rawText = typeof content == 'string'
            ? content
            : content.filter(each=>typeof each == 'string').join("")
        const minSize = minimumViableQuoteSize(rawText, quote)
        if ((node.childComponents.openingQuote||"").length < minSize) {
            node = {...node}
            node.childComponents = {...node.childComponents}
            node.childComponents.openingQuote = quote.repeat(minSize)
            node.childComponents.closingQuote = quote.repeat(minSize)
        }
        return node
    }

    export const stringNodeToString = ({node, context})=>{
        return structure.childComponentsToString({node: repairedQuotes(withoutComments(node, context), `"`), context})
    }

//
// stringNode => js value
//
    export const blockContentToJsString = ({rawText, closingIndent}) => {
        // drop the indent prefix of every line, and the final newline (it belongs to the closing quote line)
        let text = rawText
        if (text.endsWith("\n")) {
            text = text.slice(0, -1)
        }
        if (closingIndent.length > 0) {
            text = text.split("\n").map(eachLine=>eachLine.startsWith(closingIndent) ? eachLine.slice(closingIndent.length) : eachLine).join("\n")
        }
        return text
    }

structure.RegisterConverter({
    toNode: {
        String: stringToNode,
    },
    toString: {
        String: stringNodeToString,
        BlockString: ({node, context})=>structure.childComponentsToString({node: withoutComments(node, context), context}),
        FigurativeString: ({node, context})=>structure.childComponentsToString({node: repairedQuotes(withoutComments(node, context), `'`), context}),
        BlockFigurativeString: ({node, context})=>structure.childComponentsToString({node: withoutComments(node, context), context}),
        EscapeSection: ({node, context})=>structure.childComponentsToString({node, context}),
    },
    toJs: {
        String: ({node})=>node.childComponents.content,
        BlockString: ({node})=>blockContentToJsString({
            rawText: node.childComponents.content,
            closingIndent: node.childComponents.closingIndent,
        }),
        FigurativeString: ({node, jsOf, root, stack})=>{
            return node.childComponents.content.map(
                each=>typeof each == 'string' ? each : jsOf({node: each, root, stack})
            ).join("")
        },
        BlockFigurativeString: ({node, jsOf, root, stack})=>{
            const rawText = node.childComponents.content.map(
                each=>typeof each == 'string' ? each : jsOf({node: each, root, stack})
            ).join("")
            return blockContentToJsString({ rawText, closingIndent: node.childComponents.closingIndent })
        },
        EscapeSection: ({node, jsOf, root, stack})=>{
            const value = jsOf({node: node.childComponents.content, root, stack})
            if (value instanceof Object) {
                throw Error(`Interpolating a non-primitive (map/list) into a string isn't supported`)
            }
            return `${value}`
        },
    },
})
