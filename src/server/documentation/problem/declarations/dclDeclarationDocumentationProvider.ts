// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DocumentationProvider } from "../../documentationProvider";
import { AstLookupResult } from "../../../ast/astLookupResult";
import { md } from "../../markdownUtils";

import { DclDeclarationNode } from "../../../ast/problem/declarations/dclDeclarationNode";

export class DclDeclarationDocumentationProvider
    extends DocumentationProvider<DclDeclarationNode> {

    override getDocumentation(
        node: DclDeclarationNode,
        lookup: AstLookupResult
    ): string | undefined {

        if (lookup.element !== node.keyword) {
            return undefined;
        }

        return md`
# ${node.keyword.value}

Declares one or more objects.

Examples:

\`\`\`pearl
DCL x FIXED;
DCL y Counter;
DCL (a, b) FLOAT(55);
DCL x FIXED, y Counter;
\`\`\`
`;
    }
}
