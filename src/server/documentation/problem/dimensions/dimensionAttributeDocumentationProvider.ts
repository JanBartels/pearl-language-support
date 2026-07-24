// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DocumentationProvider } from "../../documentationProvider";
import { AstLookupResult } from "../../../ast/astLookupResult";
import { md } from "../../markdownUtils";

import { DimensionAttributeNode } from "../../../ast/problem/dimensions/dimensionAttributeNode";

export class DimensionAttributeDocumentationProvider
    extends DocumentationProvider<DimensionAttributeNode> {

    override getDocumentation(
        node: DimensionAttributeNode,
        lookup: AstLookupResult
    ): string | undefined {

        if (lookup.element !== node.keyword) {
            return undefined;
        }

        return md`
# DIM

Declares the dimensions of an array.

Each dimension is specified by one set of dimension boundaries.

Examples:

\`\`\`pearl
DIM(10)
DIM(1:10)
DIM(1:10, 0:9)
\`\`\`
`;
    }

}
