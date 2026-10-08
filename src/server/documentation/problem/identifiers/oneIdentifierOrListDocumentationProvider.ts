// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DocumentationProvider } from "../../documentationProvider";
import { AstLookupResult } from "../../../ast/astLookupResult";
import type { SemanticContext } from "../../../semantic/semanticContext";
import { SymbolKind } from "../../../semantic/symbolKind";
import { appendSemanticConstantValue } from "../../semanticConstantValueDocumentation";

import { OneIdentifierOrListNode } from "../../../ast/problem/identifiers/oneIdentifierOrListNode";

export class OneIdentifierOrListDocumentationProvider
    extends DocumentationProvider<OneIdentifierOrListNode> {

    override getDocumentation(
        node: OneIdentifierOrListNode,
        lookup: AstLookupResult,
        semanticContext?: SemanticContext
    ): string | undefined {

        for (const identifier of node.identifiers) {

            if (lookup.element !== identifier) {
                continue;
            }

            const documentation = `
# Identifier

Identifier \`${identifier.value}\`.

${node.parenthesized
? "This identifier is part of a parenthesized identifier list."
: "This identifier is specified without parentheses."}
`;

            const symbol = semanticContext?.bindings.get(identifier);

            if (!symbol || symbol.kind !== SymbolKind.DataObject) {
                return documentation;
            }

            return appendSemanticConstantValue(
                documentation,
                semanticContext?.namedConstantValues.get(symbol)
            );
        }

        return undefined;
    }

}
