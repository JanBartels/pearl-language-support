// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DocumentationProvider } from "../../documentationProvider";
import { AstLookupResult } from "../../../ast/astLookupResult";
import { md } from "../../markdownUtils";

import { OneIdentifierOrListNode } from "../../../ast/problem/identifiers/oneIdentifierOrListNode";

export class OneIdentifierOrListDocumentationProvider
    extends DocumentationProvider<OneIdentifierOrListNode> {

    override getDocumentation(
        node: OneIdentifierOrListNode,
        lookup: AstLookupResult
    ): string | undefined {

        for (const identifier of node.identifiers) {

            if (lookup.element === identifier) {

                return md`
# Identifier

Identifier \`${identifier.value}\`.

${node.parenthesized
? "This identifier is part of a parenthesized identifier list."
: "This identifier is specified without parentheses."}
`;
            }
        }

        return undefined;
    }

}
