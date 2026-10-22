// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstLookupResult } from '../../../ast/astLookupResult';
import { LabeledStatementNode } from '../../../ast/problem/statements/labeledStatementNode';
import { SemanticContext } from '../../../semantic/semanticContext';
import { lookupBoundSymbol } from '../../../semantic/bindingIndex';
import { DocumentationProvider } from '../../documentationProvider';
import { appendSemanticSymbolDocumentation } from '../../semanticSymbolDocumentation';

export class LabeledStatementDocumentationProvider extends DocumentationProvider<LabeledStatementNode> {
    override getDocumentation(
        node: LabeledStatementNode,
        lookup: AstLookupResult,
        semanticContext?: SemanticContext
    ): string | undefined {
        const label = node.labels.find(value => value === lookup.element);
        if (!label) return undefined;

        const text = `# Sprungmarke ${label.value}\n\nKennzeichnet die unmittelbar folgende Anweisung. `
            + 'Mehrere Marken können dieselbe Anweisung kennzeichnen. '
            + 'Die Marke kann von GOTO-Anweisungen derselben Task oder Prozedur erreicht werden, '
            + 'sofern der Sprung nicht in einen inneren Block führt.';
        const symbol = semanticContext && lookupBoundSymbol(semanticContext.bindings, label);
        return symbol && semanticContext
            ? appendSemanticSymbolDocumentation(text, symbol, semanticContext)
            : text;
    }
}
