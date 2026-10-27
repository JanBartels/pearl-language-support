// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstLookupResult } from '../../../ast/astLookupResult';
import { FormalParameterNode } from '../../../ast/problem/declarations/formalParameterNode';
import { SemanticContext } from '../../../semantic/semanticContext';
import { lookupBoundSymbol } from '../../../semantic/bindingIndex';
import { DocumentationProvider } from '../../documentationProvider';
import { appendSemanticSymbolDocumentation } from '../../semanticSymbolDocumentation';
import { md } from '../../markdownUtils';

export class FormalParameterDocumentationProvider extends DocumentationProvider<FormalParameterNode> {
    override getDocumentation(
        node: FormalParameterNode,
        lookup: AstLookupResult,
        semanticContext?: SemanticContext
    ): string | undefined {
        const name = node.identifiers?.identifiers.find(value => value === lookup.element);
        if (name) {
            const text = md`# Parameter ${name.value}

${node.identKeyword ? 'Passed by identification (IDENT).' : 'Passed by value.'}
${node.invKeyword ? 'Assignment protection: INV.' : ''}`;
            const symbol = semanticContext
                ? lookupBoundSymbol(semanticContext.bindings, name)
                : undefined;
            return symbol && semanticContext
                ? appendSemanticSymbolDocumentation(text, symbol, semanticContext)
                : text;
        }
        if (lookup.element === node.identKeyword) {
            return md`# IDENT

The formal parameter refers to the actual argument rather than receiving a value copy.`;
        }
        if (lookup.element === node.invKeyword) {
            return md`# INV

The parameter is protected against assignments.`;
        }
        return undefined;
    }
}
