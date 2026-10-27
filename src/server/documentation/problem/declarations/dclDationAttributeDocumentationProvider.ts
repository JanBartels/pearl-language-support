// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstLookupResult } from '../../../ast/astLookupResult';
import { DclDationAttributeNode } from '../../../ast/problem/declarations/dclDationAttributeNode';
import { SemanticContext } from '../../../semantic/semanticContext';
import { lookupBoundSymbol } from '../../../semantic/bindingIndex';
import { appendSemanticSymbolDocumentation } from '../../semanticSymbolDocumentation';
import { DocumentationProvider } from '../../documentationProvider';
import { md } from '../../markdownUtils';

export class DclDationAttributeDocumentationProvider extends DocumentationProvider<DclDationAttributeNode> {
    override getDocumentation(
        node: DclDationAttributeNode,
        lookup: AstLookupResult,
        semanticContext?: SemanticContext
    ): string | undefined {
        if (lookup.element === node.keyword) {
            return md`# DATION

Declares a user dation. CREATED associates it with a system dation specified in the PROBLEM part.
`;
        }
        if (lookup.element === node.direction) {
            return md`# ${node.direction?.value}

Transfer direction of the user dation.
`;
        }
        if (lookup.element === node.dationClass) {
            return md`# ${node.dationClass?.value}

Transfer class of the user dation.
`;
        }
        if (lookup.element === node.controlKeyword || lookup.element === node.controlAll) {
            return md`# CONTROL(ALL)

Compatibility attribute for dations.
`;
        }
        if (lookup.element === node.createdKeyword) {
            return md`# CREATED

Associates this user dation with the specified system dation.
`;
        }
        if (lookup.element === node.systemDation) {
            const text = md`# ${node.systemDation?.value}

System dation associated through CREATED.
`;
            const symbol = semanticContext && node.systemDation
                ? lookupBoundSymbol(semanticContext.bindings, node.systemDation)
                : undefined;
            return symbol && semanticContext
                ? appendSemanticSymbolDocumentation(text, symbol, semanticContext)
                : text;
        }
        return undefined;
    }
}
