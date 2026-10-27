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

        if (lookup.element === node.targetInv) {
            return md`# INV (referenced object)

In \`REF INV\`, the referenced object is protected against assignment through this reference. This is distinct from \`INV REF\`, which protects the reference variable itself.`;
        }

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
DCL ReadOnlyPointer REF INV FIXED;
DCL MyBolt REF BOLT;
DCL MySemaphore REF SEMA;
DCL MyDation REF DATION INOUT ALPHIC;

TYPE TRefProc REF PROC(FIXED) RETURNS(FIXED);

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
