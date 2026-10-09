// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DocumentationProvider } from "../../documentationProvider";
import { AstLookupResult } from "../../../ast/astLookupResult";
import { md } from "../../markdownUtils";

import { SpcProblemDataAttributeNode } from "../../../ast/problem/specifications/spcProblemDataAttributeNode";

export class SpcProblemDataAttributeDocumentationProvider
    extends DocumentationProvider<SpcProblemDataAttributeNode> {

    override getDocumentation(
        node: SpcProblemDataAttributeNode,
        lookup: AstLookupResult
    ): string | undefined {

        if (
            node.inv &&
            lookup.element === node.inv
        ) {
            return md`
# INV

Assignment protection of the specified object.
`;
        }

        return undefined;
    }
}
