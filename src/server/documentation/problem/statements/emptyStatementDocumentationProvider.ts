// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstLookupResult } from '../../../ast/astLookupResult';
import { EmptyStatementNode } from '../../../ast/problem/statements/emptyStatementNode';
import { DocumentationProvider } from '../../documentationProvider';

export class EmptyStatementDocumentationProvider extends DocumentationProvider<EmptyStatementNode> {
    override getDocumentation(node: EmptyStatementNode, lookup: AstLookupResult): string | undefined {
        return lookup.element === node.semicolon
            ? '# Leeranweisung\n\n`;` ist eine ausführbare Anweisung ohne Wirkung und kann als Sprungziel markiert werden.'
            : undefined;
    }
}
