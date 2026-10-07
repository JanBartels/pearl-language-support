// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DocumentationProvider } from "../../documentationProvider";
import { AstLookupResult } from "../../../ast/astLookupResult";
import { md } from "../../markdownUtils";

import { StructTypeNode } from "../../../ast/problem/types/structTypeNode";

export class StructTypeDocumentationProvider
    extends DocumentationProvider<StructTypeNode> {

    override getDocumentation(
        node: StructTypeNode,
        lookup: AstLookupResult
    ): string | undefined {

        if (lookup.element !== node.keyword) {
            return undefined;
        }

        return md`
# STRUCT

Defines a structured data type consisting of named components.

Structure components may themselves be arrays or structures.

Example:

\`\`\`pearl
STRUCT[
    Name CHAR(20),
    Age FIXED,
    Address STRUCT[
        Street CHAR(40),
        Number FIXED
    ]
]
\`\`\`
`;
    }
}
