// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DocumentationProvider } from "../../documentationProvider";
import { AstLookupResult } from "../../../ast/astLookupResult";
import { md } from "../../markdownUtils";

import { ProblemDataAttributeNode } from "../../../ast/problem/declarations/problemDataAttributeNode";

export class ProblemDataAttributeDocumentationProvider
    extends DocumentationProvider<ProblemDataAttributeNode> {

    override getDocumentation(
        node: ProblemDataAttributeNode,
        lookup: AstLookupResult
    ): string | undefined {

        if (
            node.inv &&
            lookup.element === node.inv
        ) {
            return md`
# INV

Assignment protection for the declared object.

Apart from initialization, assignments to an object declared with \`INV\` are not permitted.
`;
        }

        return undefined;
    }
}
