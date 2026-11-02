// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DocumentationProvider } from '../../documentationProvider';
import type { AstLookupResult } from '../../../ast/astLookupResult';
import type { SemaSetStatementNode } from '../../../ast/problem/statements/semaSetStatementNode';

export class SemaSetStatementDocumentationProvider extends DocumentationProvider<SemaSetStatementNode> {
    override getDocumentation(node: SemaSetStatementNode, lookup: AstLookupResult): string | undefined {
        if (lookup.element !== node.keyword) return undefined;
        return '# SEMASET\n\nSetzt den Zähler einer SEMA-Variablen zur Laufzeit.\n\nSyntax: `SEMASET Ausdruck, SEMA-Objekt;`\n\nDer Ausdruck muss mit `FIXED(15)` verträglich sein.';
    }
}
