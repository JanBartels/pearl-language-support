// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DocumentationProvider } from "../../documentationProvider";
import { AstLookupResult } from "../../../ast/astLookupResult";
import { md } from "../../markdownUtils";

import { RefTypeNode } from "../../../ast/problem/types/refTypeNode";

export class RefTypeDocumentationProvider
    extends DocumentationProvider<RefTypeNode> {

    override getDocumentation(
        node: RefTypeNode,
        lookup: AstLookupResult
    ): string | undefined {

        if (lookup.element !== node.keyword) {
            return undefined;
        }

        return md`
# REF

Declares a reference type.

A reference contains the address of an object of the specified target type.

Examples:

\`\`\`pearl
DCL Counter FIXED;
DCL Pointer REF FIXED;

TYPE Node STRUCT[
    Value FIXED,
    Next REF Node
];
\`\`\`

A reference to an empty structure

\`\`\`pearl
REF STRUCT[]
\`\`\`

is a reference without a specific data-object type.
`;
    }
}
