// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstLookupResult } from "../../../ast/astLookupResult";
import { BlockNode } from "../../../ast/problem/statements/blockNode";
import { DocumentationProvider } from "../../documentationProvider";
import { md } from "../../markdownUtils";

export class BlockDocumentationProvider extends DocumentationProvider<BlockNode> {

    override getDocumentation(node: BlockNode, lookup: AstLookupResult): string | undefined {
        if (lookup.element === node.beginKeyword) {
            return md`
# BEGIN

Introduces a block with its own declaration scope, ending at the matching END.
`;
        }

        if (lookup.element === node.endKeyword) {
            return md`
# END

Closes the matching BEGIN block.
`;
        }

        if (lookup.element === node.endIdentifier) {
            return md`
# Block identifier

Names this block for EXIT statements. Label resolution is not yet implemented.
`;
        }

        return undefined;
    }
}
