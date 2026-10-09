// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { OneIdentifierOrListNode } from '../../../ast/problem/identifiers/oneIdentifierOrListNode';
import { AstLookupResult } from '../../../ast/astLookupResult';
import { lookupBoundSymbol } from '../../../semantic/bindingIndex';
import type { SemanticContext } from '../../../semantic/semanticContext';
import { SymbolKind } from '../../../semantic/symbolKind';
import { DocumentationProvider } from '../../documentationProvider';
import {
    appendSemanticConstantValue,
    appendSemanticInitialValue,
    appendSemanticPresetValues
} from '../../semanticConstantValueDocumentation';
import { appendSemanticSymbolDocumentation } from '../../semanticSymbolDocumentation';

export class OneIdentifierOrListDocumentationProvider extends DocumentationProvider<OneIdentifierOrListNode> {
    override getDocumentation(
        node: OneIdentifierOrListNode,
        lookup: AstLookupResult,
        semanticContext?: SemanticContext
    ): string | undefined {
        for (const identifier of node.identifiers) {
            if (lookup.element !== identifier) {
                continue;
            }

            let documentation = `
# Identifier

Identifier \`${identifier.value}\`.

${node.parenthesized
    ? 'This identifier is part of a parenthesized identifier list.'
    : 'This identifier is specified without parentheses.'}
`;

            if (!semanticContext) {
                return documentation;
            }

            const symbol = lookupBoundSymbol(semanticContext.bindings, identifier);
            if (!symbol) {
                return documentation;
            }

            documentation = appendSemanticSymbolDocumentation(documentation, symbol, semanticContext);

            if (symbol.kind === SymbolKind.DataObject) {
                const constantValue = semanticContext.namedConstantValues.get(symbol);

                if (constantValue) {
                    documentation = appendSemanticConstantValue(documentation, constantValue);
                } else {
                    documentation = appendSemanticInitialValue(
                        documentation,
                        semanticContext.initialValues.get(symbol)
                    );
                }

                documentation = appendSemanticPresetValues(
                    documentation,
                    semanticContext.semaPresetValues.get(symbol)
                );
            }

            return documentation;
        }

        return undefined;
    }
}
