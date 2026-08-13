import "../main.js" // load all converters into the registries
import * as structure from "../structure.js"
import "./0_0_non_values.js" // need to load in Comment
import "./1_2_atom.js"
import { mapToNode } from "./1_6_map.js"
import { capitalize, indent, toCamelCase, toPascalCase, toKebabCase, toSnakeCase, toScreamingtoKebabCase, toScreamingtoSnakeCase, toRepresentation, toString } from "https://esm.sh/gh/jeff-hykin/good-js@1.5.0.0/source/string.js"

console.log(`\nempty map`)
console.log(
    toRepresentation(
        mapToNode({
            remaining: `{}`,
            context: new structure.Context({}),
        })
    )
)
console.log(`\nempty map with comment`)
console.log(
    toRepresentation(
        mapToNode({
            remaining: ` {} # Howdy`,
            context: new structure.Context({}),
        })
    )
)
console.log(`\nempty map with comment and adjective`)
console.log(
    toRepresentation(
        mapToNode({
            remaining: `(set) {} # Howdy`,
            context: new structure.Context({}),
        })
    )
)
console.log(
    toRepresentation(
       structure.toString({
            context: new structure.Context({}),
            node: mapToNode({
                remaining: ` { } `,
                context: new structure.Context({}),
            }),
       })
    )
)