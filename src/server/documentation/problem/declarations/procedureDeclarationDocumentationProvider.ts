// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstLookupResult } from '../../../ast/astLookupResult';
import { ProcedureDeclarationNode } from '../../../ast/problem/declarations/procedureDeclarationNode';
import { SemanticContext } from '../../../semantic/semanticContext';
import { lookupBoundSymbol } from '../../../semantic/bindingIndex';
import { DocumentationProvider } from '../../documentationProvider';
import { appendSemanticSymbolDocumentation } from '../../semanticSymbolDocumentation';
import type { CallSignatureIndex } from '../../../semantic/callSignatureIndex';
import { formatCallSignatures } from '../../callSignatureFormatting';
import { md } from '../../markdownUtils';
import { shellProcedureReturnStatusDocumentation } from '../../module/shellProcedureReturnStatusDocumentation';

export class ProcedureDeclarationDocumentationProvider
    extends DocumentationProvider<ProcedureDeclarationNode> {
    override getDocumentation(
        node: ProcedureDeclarationNode,
        lookup: AstLookupResult,
        semanticContext?: SemanticContext,
        callSignatures?: CallSignatureIndex
    ): string | undefined {
        // The semantic shell mapping comes from SHELLMODULE validation.
        // Do not inspect unrelated AST nodes or repeat name resolution here.
        const shellCommand = semanticContext?.shellCommandsByProcedure.get(node);
        const shellName = shellCommand?.commandName.value.replace(/^['"]|['"]$/g, '');
        const shellDocumentation = shellName
            ? md`\n\n**Shell command:** \`${shellName}\``
                + `\n\n${shellProcedureReturnStatusDocumentation}`
            : '';

        if (lookup.element === node.name) {
            let text = md`# Procedure ${node.name.value}

${node.parameters.reduce((n, parameter) => n + (parameter.identifiers?.identifiers.length ?? 1), 0)}
formal parameter(s)${node.returnsKeyword ? ', with a result' : ', without a result'}.
`;
            const symbol = semanticContext
                ? lookupBoundSymbol(semanticContext.bindings, node.name)
                : undefined;
            text += shellDocumentation;
            return symbol && semanticContext
                ? appendSemanticSymbolDocumentation(text, symbol, semanticContext,
                    formatCallSignatures(callSignatures?.getForElement(node.name)))
                : text;
        }
        if (lookup.element === node.xhelpText) {
            return md`# XHELP

Shell command help text: ${node.xhelpText?.value ?? ''}`;
        }
        if (lookup.element === node.procKeyword) {
            return md`# PROC

Declares a procedure. Formal parameters belong to the procedure scope.
The body contains local declarations followed by statements.` + shellDocumentation;
        }
        if (lookup.element === node.returnsKeyword) {
            return md`# RETURNS

Declares the type of the procedure result.`
                + (shellCommand ? `\n\n${shellProcedureReturnStatusDocumentation}` : '');
        }
        if (lookup.element === node.endKeyword) {
            return md`# END

Ends the procedure \`${node.name.value}\`.`;
        }
        return undefined;
    }
}
