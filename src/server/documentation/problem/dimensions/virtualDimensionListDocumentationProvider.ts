// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DocumentationProvider } from "../../documentationProvider";
import { AstLookupResult } from "../../../ast/astLookupResult";
import { md } from "../../markdownUtils";

import { VirtualDimensionListNode } from "../../../ast/problem/dimensions/virtualDimensionListNode";

export class VirtualDimensionListDocumentationProvider
    extends DocumentationProvider<VirtualDimensionListNode> {

    override getDocumentation(
        _node: VirtualDimensionListNode,
        _lookup: AstLookupResult
    ): string | undefined {

        return md`
# Virtual dimension list

A virtual dimension list groups one or more \`DIM\` attributes.

Each \`DIM\` attribute specifies the bounds of one or more array dimensions.
`;
    }

}
