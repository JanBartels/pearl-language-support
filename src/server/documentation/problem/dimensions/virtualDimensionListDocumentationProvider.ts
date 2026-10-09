// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DocumentationProvider } from "../../documentationProvider";
import { AstLookupResult } from "../../../ast/astLookupResult";
import { md } from "../../markdownUtils";

import { VirtualDimensionListNode } from "../../../ast/problem/dimensions/virtualDimensionListNode";

export class VirtualDimensionListDocumentationProvider
    extends DocumentationProvider<VirtualDimensionListNode> {

    override getDocumentation(
        node: VirtualDimensionListNode,
        _lookup: AstLookupResult
    ): string | undefined {

        return md`
# Virtual dimension list

Specifies only the number of dimensions of an array, not their bounds.

The virtual dimension list has rank ${node.rank}.

Examples:

\`\`\`pearl
()    ! one-dimensional
(,)   ! two-dimensional
(,,)  ! three-dimensional
\`\`\`
`;
    }

}
