import * as utils from "./utils.js"

// 
// 
// errors
// 
// 
    export class ParserError extends Error {
        constructor({ message, context }) {
            super(message)
            this.context = context
        }
    }

    export class CantDecodeContext extends ParserError {
        constructor({ message, context }) {
            super(message)
            this.context = context
        }
    }


// 
// 
// basic structures
// 
// 
    // Nodes should always be JSON-able (no methods, or complex data types)
    export class Node {
        constructor({toStringifier=null, childComponents={}, formattingPreferences={}}) {
            this.toStringifier = toStringifier
            this.childComponents = childComponents
            this.formattingPreferences = formattingPreferences
        }
    }

    // this is basically a registry
    export class ContextIds {
        static root = Symbol("rootContext")
        static mapKey = Symbol("mapKeyContext")
        static inlineValue = Symbol("inlineValueContext")
        static block = Symbol("blockContext")
        static referencePath = Symbol("referencePathContext")
    }

    // contexts are immutable (auto-enforced/guaranteed)
    export class Context {
        constructor({debugInfo={}, parentContext=null, id=ContextIds.root, indent=""}) {
            this.debugInfo     = { stringIndex: 0, lineIndex: 0, columnIndex: 0, ...debugInfo }
            this.parentContext = parentContext
            this.id            = id
            this.indent        = indent // exact indent string of the current block's entries
            Object.freeze(this)
        }
    }

    export const toNodeifiers = {}
    export const isNodeifier = Symbol("toNodeifiers")
    export const RegisterToNodeifier = (things) => {
        // toNodeifiers accept {remaining, context} and return Nodes
        for (const [key, eachFunction] of Object.entries(things||{})) {
            if (eachFunction instanceof Function) {
                eachFunction[isNodeifier] = true
                toNodeifiers[key] = eachFunction
            }
        }
    }

    export const toStringifiers = {}
    export const isStringifier = Symbol("toStringifiers")
    export const RegisterToStringifier = (things) => {
        // toStringifiers accept {node, context} and return Nodes
        for (const [key, eachFunction] of Object.entries(things||{})) {
            if (eachFunction instanceof Function) {
                eachFunction[isStringifier] = true
                toStringifiers[key] = eachFunction
            }
        }
    }

    export const toJsifiers = {}
    export const RegisterToJsifier = (things) => {
        // toJsifiers accept {node, root, resolutionStack} and return plain JS values
        for (const [key, eachFunction] of Object.entries(things||{})) {
            if (eachFunction instanceof Function) {
                toJsifiers[key] = eachFunction
            }
        }
    }

    export const RegisterConverter = ({toNode, toString, toJs}) => {
        RegisterToNodeifier(toNode)
        RegisterToStringifier(toString)
        RegisterToJsifier(toJs)
    }

// 
// toString and toNode
// 
    /**
     * convert a whole XData document string into a Document node
     *
     * @example
     *     toNode("10")
     * @returns {Node} document node
     */
    export const toNode = (string)=>{
        return toNodeifiers.Document({ remaining: string, context: new Context({}) })
    }

    export function toString({node, parentNode, context}) {
        // base case 1
        if (node == null) {
            return ""
        // base case 2
        } else if (typeof node == 'string') {
            return node
        } else if (node instanceof Array) {
            return node.map(each=>toString({node: each, context, parentNode})).join("")
        // recursive case 2 // if it is a proper node
        } else if (node instanceof Object) {
            if (node.toStringifier && toStringifiers[node.toStringifier]) {
                const toStringifier = toStringifiers[node.toStringifier]
                return toStringifier({ node, context })
            }
        }

        throw Error(`I don't know how to convert \n${utils.toString(node)}\nof\n${utils.toString(parentNode)}\n into an XData string. It doesnt have a .toStringifier property that is in the available toStringifiers:\n${utils.toString(Object.keys(toStringifiers))}`)
    }

    export function childComponentsToString({node, context}) {
        let string = ""
        for (const [key, value] of Object.entries(node.childComponents)) {
            string += toString({node: value, parentNode: node, context })
        }
        return string
    }