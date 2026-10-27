// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { NamedTypeNode } from '../../../ast/problem/types/namedTypeNode';
import { AstLookupResult } from '../../../ast/astLookupResult';
import { lookupBoundSymbol } from '../../../semantic/bindingIndex';
import type { SemanticContext } from '../../../semantic/semanticContext';
import { DocumentationProvider } from '../../documentationProvider';
import { md } from '../../markdownUtils';
import { appendSemanticSymbolDocumentation } from '../../semanticSymbolDocumentation';
import type { CallSignatureIndex } from '../../../semantic/callSignatureIndex';
import { formatCallSignatures } from '../../callSignatureFormatting';

export class NamedTypeDocumentationProvider extends DocumentationProvider<NamedTypeNode> {
    override getDocumentation(
        node: NamedTypeNode,
        lookup: AstLookupResult,
        semanticContext?: SemanticContext,
        callSignatures?: CallSignatureIndex
    ): string | undefined {
        if (lookup.element !== node.name) {
            return undefined;
        }

        const documentation = md`
# Named type

Reference to the user-defined type \`${node.name.value}\`.
`;

        if (!semanticContext) {
            return documentation;
        }

        const symbol = lookupBoundSymbol(semanticContext.bindings, node.name);
        return symbol ? appendSemanticSymbolDocumentation(documentation, symbol, semanticContext,
            formatCallSignatures(callSignatures?.getForElement(node.name))) : documentation;
    }
}
