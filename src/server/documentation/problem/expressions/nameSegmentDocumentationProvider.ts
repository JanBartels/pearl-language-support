// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { AstLookupResult } from '../../../ast/astLookupResult';
import { NameExpressionNode } from '../../../ast/problem/expressions/nameExpressionNode';
import type { NameSegmentNode } from '../../../ast/problem/expressions/nameSegmentNode';
import { lookupBoundSymbol } from '../../../semantic/bindingIndex';
import type { SemanticContext } from '../../../semantic/semanticContext';
import type { CallSignatureIndex } from '../../../semantic/callSignatureIndex';
import { DocumentationProvider } from '../../documentationProvider';
import { md } from '../../markdownUtils';
import { appendSemanticSymbolDocumentation } from '../../semanticSymbolDocumentation';
import { formatCallSignatures } from '../../callSignatureFormatting';
import { formatBuiltinSignature } from '../../../semantic/builtins/builtinSignature';
import { appendExpressionTypeDocumentation } from './expressionTypeDocumentation';

export class NameSegmentDocumentationProvider extends DocumentationProvider<NameSegmentNode> {
    override getDocumentation(
        node: NameSegmentNode,
        lookup: AstLookupResult,
        semanticContext?: SemanticContext,
        callSignatures?: CallSignatureIndex
    ): string | undefined {
        if (lookup.element === node.dot) {
            return '# Structure selection\n\nThe dot selects a component of a structured name.';
        }
        if (lookup.element !== node.identifier) return undefined;

        const symbol = semanticContext && lookupBoundSymbol(semanticContext.bindings, node.identifier);
        const selector = !symbol && node.dot && node.suffix
            && (node.identifier.value === 'BIT' || node.identifier.value === 'CHAR'
                || node.identifier.value === 'CHARACTER');
        let documentation = selector
            ? md`# String selector

\`.${node.identifier.value}(i)\` selects a single ${node.identifier.value === 'BIT' ? 'bit' : 'character'} of the named object. Its index must be FIXED.`
            : md`# Identifier

Name \`${node.identifier.value}\` in an expression.`;
        if (symbol && semanticContext) {
            // Shared display signature for CALL and function expressions.
            // Array indices have no signature in the compiler-side index.
            documentation = appendSemanticSymbolDocumentation(
                documentation, symbol, semanticContext,
                formatCallSignatures(callSignatures?.getForElement(node.identifier))
            );
        } else {
            const builtin = semanticContext?.builtinBindings.get(node.identifier);
            if (builtin) {
                documentation += `\n\n**RTOS-UH-Einbaufunktion:** ${builtin.description}`
                    + `\n\n**Signatur:** \`${builtin.signatures.map(signature =>
                        formatBuiltinSignature(builtin, signature)).join(' | ')}\``
                    + `\n\n**Quelle:** ${builtin.source}`;
            }
        }
        // A segment is a syntactic component; only the enclosing expression
        // has a result type. Do not invent a type for unimplemented selections.
        if (node.parent instanceof NameExpressionNode
            && node.parent.segments[node.parent.segments.length - 1] === node) {
            documentation = appendExpressionTypeDocumentation(documentation, node.parent, semanticContext);
        }
        return documentation;
    }
}
