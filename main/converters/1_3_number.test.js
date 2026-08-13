import * as structure from "../structure.js"
import "./0_0_non_values.js" // need to load in Comment
import { numberToNode } from "./1_3_number.js"
import { capitalize, indent, toCamelCase, toPascalCase, toKebabCase, toSnakeCase, toScreamingtoKebabCase, toScreamingtoSnakeCase, toRepresentation, toString } from "https://esm.sh/gh/jeff-hykin/good-js@1.5.0.0/source/string.js"

console.log(
    toRepresentation(
        numberToNode({
            remaining: `10.4`,
            context: new structure.Context({}),
        })
    )
)
console.log(
    toRepresentation(
        numberToNode({
            remaining: `-10`,
            context: new structure.Context({}),
        })
    )
)
console.log(
    toRepresentation(
        numberToNode({
            remaining: `+99.4`,
            context: new structure.Context({}),
        })
    )
)
console.log(
    toRepresentation(
        numberToNode({
            remaining: `(degrees) 99.4`,
            context: new structure.Context({}),
        })
    )
)
console.log(
    toRepresentation(
       structure.toString({
            context: new structure.Context({}),
            node: numberToNode({
                remaining: `0.249082`,
                context: new structure.Context({}),
            }),
       })
    )
)