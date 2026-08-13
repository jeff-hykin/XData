import "../main.js" // load all converters into the registries
import * as structure from "../structure.js"
import "./0_0_non_values.js" // need to load in Comment
import "./1_2_atom.js"
import { listToNode } from "./1_5_list.js"
import { capitalize, indent, toCamelCase, toPascalCase, toKebabCase, toSnakeCase, toScreamingtoKebabCase, toScreamingtoSnakeCase, toRepresentation, toString } from "https://esm.sh/gh/jeff-hykin/good-js@1.5.0.0/source/string.js"

console.log(`\nempty list`)
console.log(
    toRepresentation(
        listToNode({
            remaining: `[]`,
            context: new structure.Context({}),
        })
    )
)
console.log(`\nempty list with comment`)
console.log(
    toRepresentation(
        listToNode({
            remaining: ` [] # Howdy`,
            context: new structure.Context({}),
        })
    )
)
console.log(`\nempty list with comment and adjective`)
console.log(
    toRepresentation(
        listToNode({
            remaining: `(names) [] # Howdy`,
            context: new structure.Context({}),
        })
    )
)
console.log(
    toRepresentation(
       structure.toString({
            context: new structure.Context({}),
            node: listToNode({
                remaining: ` [ ] `,
                context: new structure.Context({}),
            }),
       })
    )
)