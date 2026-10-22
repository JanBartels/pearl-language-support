// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../../core/sourceValue';
import { AstKind } from '../../astKind';
import { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';
import { DocumentationProvider } from '../../../documentation/documentationProvider';
import { GotoStatementDocumentationProvider } from '../../../documentation/problem/statements/gotoStatementDocumentationProvider';

/** GOTO Identifier ';'. A missing target is retained for parser recovery. */
export class GotoStatementNode extends AstNode {
    private static readonly provider = new GotoStatementDocumentationProvider();

    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly target: SourceValue<string> | undefined
    ) {
        super(AstKind.GotoStatement);
    }

    override documentationProvider(): DocumentationProvider<GotoStatementNode> {
        return GotoStatementNode.provider;
    }

    override lookupSourceValue(offset: number): AstLookupResult | undefined {
        return this.lookupOwnSourceValue(offset, this.keyword)
            ?? this.lookupOwnSourceValue(offset, this.target);
    }

    override dumpLabel(): string {
        return `GotoStatement(${this.target?.value ?? '<error>'})`;
    }
}
