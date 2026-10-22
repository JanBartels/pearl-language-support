// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstLookupResult } from '../../../ast/astLookupResult';
import { GotoStatementNode } from '../../../ast/problem/statements/gotoStatementNode';
import { SemanticContext } from '../../../semantic/semanticContext';
import { lookupBoundSymbol } from '../../../semantic/bindingIndex';
import { DocumentationProvider } from '../../documentationProvider';
import { appendSemanticSymbolDocumentation } from '../../semanticSymbolDocumentation';

export class GotoStatementDocumentationProvider extends DocumentationProvider<GotoStatementNode> {
    override getDocumentation(
        node: GotoStatementNode,
        lookup: AstLookupResult,
        semanticContext?: SemanticContext
    ): string | undefined {
        if (lookup.element === node.keyword) {
            return '# GOTO\n\n`GOTO marke;` springt zur benannten Anweisung innerhalb derselben Task oder Prozedur. '
                + 'Vorwärtssprünge sind möglich. Ein Sprung in einen inneren Block oder eine Schleife ist nicht erlaubt.';
        }
        if (lookup.element === node.target && node.target) {
            const text = `# Sprungziel ${node.target.value}\n\nSprung zur Anweisung mit der Marke \`${node.target.value}:\`.`;
            const symbol = semanticContext && lookupBoundSymbol(semanticContext.bindings, node.target);
            return symbol && semanticContext
                ? appendSemanticSymbolDocumentation(text, symbol, semanticContext)
                : text;
        }
        return undefined;
    }
}
