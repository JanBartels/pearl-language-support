// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DocumentationProvider } from "../../documentationProvider";
import { AstLookupResult } from "../../../ast/astLookupResult";
import { md } from "../../markdownUtils";

import { NamedTypeNode } from "../../../ast/problem/types/namedTypeNode";

export class NamedTypeDocumentationProvider
    extends DocumentationProvider<NamedTypeNode> {

    override getDocumentation(
        node: NamedTypeNode,
        lookup: AstLookupResult
    ): string | undefined {

        if (lookup.element !== node.name) {
            return undefined;
        }

        return md`
# Named type

Reference to the user-defined type \`${node.name.value}\`.
`;
    }
}
