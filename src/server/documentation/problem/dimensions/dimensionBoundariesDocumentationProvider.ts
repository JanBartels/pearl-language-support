// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DocumentationProvider } from "../../documentationProvider";
import { AstLookupResult } from "../../../ast/astLookupResult";
import { md } from "../../markdownUtils";

import { DimensionBoundariesNode } from "../../../ast/problem/dimensions/dimensionBoundariesNode";

export class DimensionBoundariesDocumentationProvider
    extends DocumentationProvider<DimensionBoundariesNode> {

    override getDocumentation(
        node: DimensionBoundariesNode,
        lookup: AstLookupResult
    ): string | undefined {

        if (lookup.node === node.lowerBoundary) {

            return md`
# Lower dimension boundary

The lower boundary of an array dimension.

If omitted, the lower boundary defaults to **1**.
`;
        }

        if (lookup.node === node.upperBoundary) {

            return md`
# Upper dimension boundary

The upper boundary of an array dimension.

The upper boundary is mandatory.
`;
        }

        return undefined;
    }

}
