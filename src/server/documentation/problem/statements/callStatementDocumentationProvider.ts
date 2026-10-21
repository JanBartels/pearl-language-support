// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstLookupResult } from '../../../ast/astLookupResult';
import { CallStatementNode } from '../../../ast/problem/statements/callStatementNode';
import { SemanticContext } from '../../../semantic/semanticContext';
import { lookupBoundSymbol } from '../../../semantic/bindingIndex';
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
            return symbol && semanticContext
                ? appendSemanticSymbolDocumentation(text, symbol, semanticContext) : text;
        }
        return undefined;
    }
}
