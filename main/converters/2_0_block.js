import * as structure from "../structure.js"
import { ParserError, ContextIds } from "../structure.js"
import * as tools from "../xdata_tools.js"
import * as utils from "../utils.js"
import { escapeRegexMatch } from "https://esm.sh/gh/jeff-hykin/good-js@1.5.0.0/source/string.js"

import "./0_0_non_values.js"
import "./values.js"
import { blockStringLiteralToNode, blockFigurativeStringToNode } from "./1_4_string.js"
import { mapNodeToJs } from "./1_6_map.js"

//
// helpers
//
    const blockContextFrom = (context, indent) => {
        return new structure.Context({ parentContext: context, id: ContextIds.block, indent })
    }

    // indent of the first line that isn't blank and isn't a comment
    export const firstRealLineIndent = (remaining) => {
        for (const eachLine of remaining.split("\n")) {
            if (!utils.isBlankOrCommentLine(eachLine)) {
                return utils.indentOf(eachLine)
            }
        }
        return null
    }

    // tentatively pull comment/blank-line nodes; caller decides whether to keep them
    const extractCommentsAndBlanks = ({remaining, context}) => {
        const pending = []
        while (remaining.length > 0) {
            const lengthBefore = remaining.length
            try {
                var { remaining, extraction, context } = tools.extract({ pattern: structure.toNodeifiers.CommentOrBlankLine, from: remaining, context })
            } catch (error) {
                if (!(error instanceof ParserError)) {
                    throw error
                }
                break
            }
            if (remaining.length == lengthBefore) {
                break
            }
            pending.push(extraction)
        }
        return { remaining, context, pending }
    }

//
// definitions (the right-hand side of `key:` or `- `)
//
    // a value-less definition, e.g. `key:` with nothing after it
    export const emptyValueToNode = ({remaining, context})=>{
        var { remaining, extraction, context } = tools.extract({ pattern: /^ *(?=\n|$)/, from: remaining, context })
        return new structure.Node({
            toStringifier: "EmptyValue",
            childComponents: { whitespace: extraction },
            formattingPreferences: {},
        })
    }

    // value indented on the line(s) below `key:` or `- `
    export const nextLineValueToNode = ({remaining, context})=>{
        const childComponents = {
            lineEnd: null, // Comment node or " ...\n" string
            value: null, // BlockList, BlockMap, or OwnLineScalar node
        }

        try {
            var { remaining, extraction, context } = tools.extract({ pattern: structure.toNodeifiers.Comment, from: remaining, context })
            childComponents.lineEnd = extraction
        } catch (error) {
            if (!(error instanceof ParserError)) {
                throw error
            }
            var { remaining, extraction, context } = tools.extract({ pattern: /^ *\n/, from: remaining, context })
            childComponents.lineEnd = extraction
        }

        const childIndent = firstRealLineIndent(remaining)
        const parentIndent = context.indent || ""
        if (childIndent == null || !(childIndent.startsWith(parentIndent) && childIndent.length > parentIndent.length)) {
            throw new ParserError({ message: `expected an indented block after this line`, context })
        }

        var { remaining, extraction, context } = tools.extract({
            oneOf: [blockListToNode, blockMapToNode, ownLineScalarToNode],
            from: remaining,
            context: blockContextFrom(context, childIndent),
        })
        childComponents.value = extraction

        return new structure.Node({
            toStringifier: "NextLineValue",
            childComponents,
            formattingPreferences: {},
        })
    }

    // a lone value on its own (indented) line
    export const ownLineScalarToNode = ({remaining, context})=>{
        const childComponents = {
            leadingCommentsAndLines: [], // array of nodes
            value: null,
            newline: null, // string
        }

        var { remaining, context, pending } = extractCommentsAndBlanks({remaining, context})
        childComponents.leadingCommentsAndLines = pending

        var { remaining, extraction, context } = tools.extract({
            oneOf: [blockStringLiteralToNode, blockFigurativeStringToNode, structure.toNodeifiers.InlineValue],
            from: remaining,
            context,
        })
        childComponents.value = extraction

        var { remaining, extraction, context } = tools.extract({ pattern: /^\n?/, from: remaining, context })
        childComponents.newline = extraction

        return new structure.Node({
            toStringifier: "OwnLineScalar",
            childComponents,
            formattingPreferences: {},
        })
    }

    export const definitionToNode = ({remaining, context})=>{
        var { remaining, extraction, context } = tools.extract({
            oneOf: [
                blockStringLiteralToNode,
                blockFigurativeStringToNode,
                structure.toNodeifiers.InlineValue,
                nextLineValueToNode,
                emptyValueToNode,
            ],
            from: remaining,
            context,
        })
        return extraction
    }

//
// block map:  key: value   lines
//
    export const mapEntryToNode = ({remaining, context})=>{
        const childComponents = {
            indent: null, // string
            key: null, // node
            colon: null, // string
            value: null, // node
            newline: null, // string
        }

        var { remaining, extraction, context } = tools.extract({
            pattern: new RegExp(`^${escapeRegexMatch(context.indent||"")}(?=[^ \\t\\n])`),
            from: remaining,
            context,
        })
        childComponents.indent = extraction

        var { remaining, extraction, context } = tools.extract({
            pattern: structure.toNodeifiers.Key,
            from: remaining,
            context: new structure.Context({ parentContext: context, id: ContextIds.mapKey }),
        })
        childComponents.key = extraction

        var { remaining, extraction, context } = tools.extract({ pattern: /^:/, from: remaining, context })
        childComponents.colon = extraction

        var { remaining, extraction, context } = tools.extract({ pattern: definitionToNode, from: remaining, context })
        childComponents.value = extraction

        var { remaining, extraction, context } = tools.extract({ pattern: /^\n?/, from: remaining, context })
        childComponents.newline = extraction

        return new structure.Node({
            toStringifier: "MapEntry",
            childComponents,
            formattingPreferences: {},
        })
    }

    export const blockMapToNode = ({remaining, context})=>{
        const entries = [] // MapEntry, Comment, and BlankLine nodes
        while (true) {
            const savedRemaining = remaining
            const savedContext = context
            var { remaining, context, pending } = extractCommentsAndBlanks({remaining, context})
            try {
                var { remaining, extraction, context } = tools.extract({ pattern: mapEntryToNode, from: remaining, context })
            } catch (error) {
                if (!(error instanceof ParserError)) {
                    throw error
                }
                // the comments/blank lines after the last entry belong to the parent
                remaining = savedRemaining
                context = savedContext
                break
            }
            entries.push(...pending, extraction)
        }
        if (!entries.some(each=>each.toStringifier == "MapEntry")) {
            throw new ParserError({ message: `expected at least one key: value line`, context })
        }
        return new structure.Node({
            toStringifier: "BlockMap",
            childComponents: { entries },
            formattingPreferences: {},
        })
    }

//
// block list:  `- value`  lines
//
    export const listEntryToNode = ({remaining, context})=>{
        const childComponents = {
            indent: null, // string
            dash: null, // string
            value: null, // node
            newline: null, // string
        }

        var { remaining, extraction, context } = tools.extract({
            pattern: new RegExp(`^${escapeRegexMatch(context.indent||"")}(?=[^ \\t\\n])`),
            from: remaining,
            context,
        })
        childComponents.indent = extraction

        var { remaining, extraction, context } = tools.extract({ pattern: /^-(?= |\n|$)/, from: remaining, context })
        childComponents.dash = extraction

        var { remaining, extraction, context } = tools.extract({ pattern: definitionToNode, from: remaining, context })
        childComponents.value = extraction

        var { remaining, extraction, context } = tools.extract({ pattern: /^\n?/, from: remaining, context })
        childComponents.newline = extraction

        return new structure.Node({
            toStringifier: "ListEntry",
            childComponents,
            formattingPreferences: {},
        })
    }

    export const blockListToNode = ({remaining, context})=>{
        const entries = [] // ListEntry, Comment, and BlankLine nodes
        while (true) {
            const savedRemaining = remaining
            const savedContext = context
            var { remaining, context, pending } = extractCommentsAndBlanks({remaining, context})
            try {
                var { remaining, extraction, context } = tools.extract({ pattern: listEntryToNode, from: remaining, context })
            } catch (error) {
                if (!(error instanceof ParserError)) {
                    throw error
                }
                remaining = savedRemaining
                context = savedContext
                break
            }
            entries.push(...pending, extraction)
        }
        if (!entries.some(each=>each.toStringifier == "ListEntry")) {
            throw new ParserError({ message: `expected at least one "- value" line`, context })
        }
        return new structure.Node({
            toStringifier: "BlockList",
            childComponents: { entries },
            formattingPreferences: {},
        })
    }

//
// whole document
//
    export const documentToNode = ({remaining, context})=>{
        const childComponents = {
            value: null, // BlockList, BlockMap, or OwnLineScalar node (null for an empty/comment-only document)
            trailingCommentsAndLines: [], // array of nodes
        }

        const rootIndent = firstRealLineIndent(remaining)
        if (rootIndent != null) {
            var { remaining, extraction, context } = tools.extract({
                oneOf: [blockListToNode, blockMapToNode, ownLineScalarToNode],
                from: remaining,
                context: blockContextFrom(context, rootIndent),
            })
            childComponents.value = extraction
        }

        var { remaining, context, pending } = extractCommentsAndBlanks({remaining, context})
        childComponents.trailingCommentsAndLines = pending

        if (remaining.length > 0) {
            throw Error(`Couldn't parse the whole document, got stuck at:\n${remaining.slice(0, 200)}`)
        }

        return new structure.Node({
            toStringifier: "Document",
            childComponents,
            formattingPreferences: {},
        })
    }

const justChildComponents = ({node, context})=>structure.childComponentsToString({node, context})
structure.RegisterConverter({
    toNode: {
        Document: documentToNode,
        BlockMap: blockMapToNode,
        BlockList: blockListToNode,
    },
    toString: {
        Document: justChildComponents,
        BlockMap: justChildComponents,
        BlockList: justChildComponents,
        MapEntry: justChildComponents,
        ListEntry: justChildComponents,
        NextLineValue: justChildComponents,
        OwnLineScalar: justChildComponents,
        EmptyValue: justChildComponents,
    },
    toJs: {
        Document: ({node, jsOf, root, stack})=>node.childComponents.value == null ? null : jsOf({node: node.childComponents.value, root, stack}),
        BlockMap: mapNodeToJs,
        BlockList: ({node, jsOf, root, stack})=>{
            return node.childComponents.entries.filter(
                each=>each.toStringifier == "ListEntry"
            ).map(
                each=>jsOf({node: each.childComponents.value, root, stack})
            )
        },
        NextLineValue: ({node, jsOf, root, stack})=>jsOf({node: node.childComponents.value, root, stack}),
        OwnLineScalar: ({node, jsOf, root, stack})=>jsOf({node: node.childComponents.value, root, stack}),
        EmptyValue: ()=>null,
    },
})
