import { toRepresentation, toString } from "https://esm.sh/gh/jeff-hykin/good-js@1.5.0.0/source/string.js"

export { toString, toRepresentation }

export const indent = ({string, indent}) => {
    return string.replace(/(^|\n)/g, `$1${indent}`)
}

// NOTE: pattern must be ^-anchored; this only ever pulls off the front
export const extractFirst = ({ pattern, from }) => {
    const match = from.match(pattern)
    if (match && match.index === 0) {
        return {
            remaining: from.slice(match[0].length),
            extraction: match[0],
        }
    }
    return {
        remaining: from,
        extraction: null,
    }
}

export const indentOf = (line) => line.match(/^[ \t]*/)[0]

export const isBlankOrCommentLine = (line) => line.match(/^[ \t]*(#.*)?$/) != null

/**
 * pull off every leading line that is indented more than `parentIndentSize`
 *
 * blank/comment lines are absorbed only when a deeper-indented real line follows them
 *
 * @returns {{extraction: String|null, remaining: String, indent: String|null}}
 */
export const extractIndentedBlock = ({ from, parentIndentSize=-1 }) => {
    const lines = from.split("\n")
    let blockIndent = null
    let lineCount = 0
    let pendingCount = 0
    for (const eachLine of lines) {
        if (isBlankOrCommentLine(eachLine)) {
            pendingCount += 1
            continue
        }
        const eachIndentSize = indentOf(eachLine).length
        if (eachIndentSize <= parentIndentSize) {
            break
        }
        if (blockIndent == null) {
            blockIndent = indentOf(eachLine)
        } else if (eachIndentSize < blockIndent.length) {
            break
        }
        lineCount += pendingCount + 1
        pendingCount = 0
    }
    if (blockIndent == null) {
        return { extraction: null, remaining: from, indent: null }
    }
    const blockLines = lines.slice(0, lineCount)
    const charCount = blockLines.reduce((total, each)=>total + each.length + 1, 0)
    return {
        extraction: blockLines.join("\n"),
        remaining: from.slice(charCount),
        indent: blockIndent,
    }
}
