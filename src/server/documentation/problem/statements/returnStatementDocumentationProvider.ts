// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstLookupResult } from '../../../ast/astLookupResult';
import { ReturnStatementNode } from '../../../ast/problem/statements/returnStatementNode';
import { ProcedureDeclarationNode } from '../../../ast/problem/declarations/procedureDeclarationNode';
import { DocumentationProvider } from '../../documentationProvider';
import { md } from '../../markdownUtils';

export class ReturnStatementDocumentationProvider extends DocumentationProvider<ReturnStatementNode> {
    override getDocumentation(node: ReturnStatementNode, lookup: AstLookupResult): string | undefined {
        if (lookup.element !== node.keyword) return undefined;
        let parent = node.parent;
        while (parent && !(parent instanceof ProcedureDeclarationNode)) parent = parent.parent;
        const procedure = parent as ProcedureDeclarationNode | undefined;
        return md`# RETURN

${node.expression ? 'Returns a value.' : 'Returns from the procedure.'}
${procedure ? `
Belongs to procedure \`${procedure.name.value}\`.` : ''}`;
    }
}
