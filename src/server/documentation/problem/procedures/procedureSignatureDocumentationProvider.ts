// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstLookupResult } from '../../../ast/astLookupResult';
import { ProcedureSignatureNode } from '../../../ast/problem/procedures/procedureSignatureNode';
import { DocumentationProvider } from '../../documentationProvider';

export class ProcedureSignatureDocumentationProvider extends DocumentationProvider<ProcedureSignatureNode> {
    override getDocumentation(node: ProcedureSignatureNode, lookup: AstLookupResult): string | undefined {
        if (lookup.element === node.keyword) {
            return `# ${node.keyword.value}\n\nProzedursignatur mit ${node.parameters.length} Parametern` +
                (node.returnsKeyword ? ' und Ergebnistyp.' : ' ohne Ergebnistyp.')
                + (node.keyword.value.endsWith('_C')
                    ? '\n\nRTOS-UH: Diese Variante verwendet die C-Aufrufkonvention.' : '');
        }
        if (lookup.element === node.returnsKeyword) {
            return '# RETURNS\n\nErgebnistyp der Prozedursignatur.';
        }
        return undefined;
    }
}
