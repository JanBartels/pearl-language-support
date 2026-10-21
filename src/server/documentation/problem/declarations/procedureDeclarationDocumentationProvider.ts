// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstLookupResult } from '../../../ast/astLookupResult';
import { ProcedureDeclarationNode } from '../../../ast/problem/declarations/procedureDeclarationNode';
import { SemanticContext } from '../../../semantic/semanticContext';
import { lookupBoundSymbol } from '../../../semantic/bindingIndex';
import { DocumentationProvider } from '../../documentationProvider';
import { appendSemanticSymbolDocumentation } from '../../semanticSymbolDocumentation';
import { md } from '../../markdownUtils';

export class ProcedureDeclarationDocumentationProvider
    extends DocumentationProvider<ProcedureDeclarationNode> {
    override getDocumentation(
        node: ProcedureDeclarationNode,
        lookup: AstLookupResult,
        semanticContext?: SemanticContext
    ): string | undefined {
        if (lookup.element === node.name) {
            let text = md`# Procedure ${node.name.value}

${node.parameters.reduce((n, parameter) => n + parameter.identifiers.identifiers.length, 0)}
formal parameter(s)${node.returnsKeyword ? ', with a result' : ', without a result'}.
`;
            const symbol = semanticContext
                ? lookupBoundSymbol(semanticContext.bindings, node.name)
                : undefined;
            return symbol && semanticContext
                ? appendSemanticSymbolDocumentation(text, symbol, semanticContext)
                : text;
        }
        if (lookup.element === node.procKeyword) {
            return md`# PROC

Declares a procedure. Formal parameters belong to the procedure scope.
The body contains local declarations followed by statements.`;
        }
        if (lookup.element === node.returnsKeyword) {
            return md`# RETURNS

Declares the type of the procedure result.`;
        }
        if (lookup.element === node.endKeyword) {
            return md`# END

Ends the procedure \`${node.name.value}\`.`;
        }
        return undefined;
    }
}
