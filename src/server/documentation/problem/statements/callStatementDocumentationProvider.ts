// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstLookupResult } from '../../../ast/astLookupResult';
import { CallStatementNode } from '../../../ast/problem/statements/callStatementNode';
import { SemanticContext } from '../../../semantic/semanticContext';
import { lookupBoundSymbol } from '../../../semantic/bindingIndex';
import { formatBuiltinSignature } from '../../../semantic/builtins/builtinSignature';
import { DocumentationProvider } from '../../documentationProvider';
import { appendSemanticSymbolDocumentation } from '../../semanticSymbolDocumentation';

export class CallStatementDocumentationProvider extends DocumentationProvider<CallStatementNode> {
    override getDocumentation(
        node: CallStatementNode,
        lookup: AstLookupResult,
        semanticContext?: SemanticContext
    ): string | undefined {
        if (lookup.element === node.keyword) {
            return '# CALL\n\nRuft eine Prozedur oder einen REF-PROC-Zeiger auf.';
        }
        if (lookup.element === node.target) {
            const text = `# Prozeduraufruf ${node.target?.value ?? ''}\n\n${
                node.argumentsList === undefined ? 'Ohne Parameterliste' :
                    `${node.argumentsList.length} Aktualparameter`}.`;
            const symbol = semanticContext && node.target
                ? lookupBoundSymbol(semanticContext.bindings, node.target) : undefined;
            if (symbol && semanticContext) {
                return appendSemanticSymbolDocumentation(text, symbol, semanticContext);
            }
            const builtin = semanticContext && node.target
                ? semanticContext.builtinBindings.get(node.target) : undefined;
            return builtin
                ? `${text}\n\n**RTOS-UH-Einbaufunktion:** ${builtin.description}`
                    + `\n\n**Signatur:** \`${builtin.signatures.map(signature =>
                        formatBuiltinSignature(builtin, signature)).join(' | ')}\``
                    + `\n\n**Quelle:** ${builtin.source}`
                : text;
        }
        return undefined;
    }
}
