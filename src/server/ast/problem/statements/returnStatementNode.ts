// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../../core/sourceValue';
import { SourceOffset } from '../../../core/sourceOffset';
import { AstKind } from '../../astKind';
import { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';
import { DocumentationProvider } from '../../../documentation/documentationProvider';
import { ReturnStatementDocumentationProvider } from '../../../documentation/problem/statements/returnStatementDocumentationProvider';
import { statementTokenText } from './statementTokenText';

export class ReturnStatementNode extends AstNode {
    private static readonly provider = new ReturnStatementDocumentationProvider();

    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly expression: readonly SourceValue<string>[] | undefined
    ) {
        super(AstKind.ReturnStatement);
    }

    override documentationProvider(): DocumentationProvider<ReturnStatementNode> {
        return ReturnStatementNode.provider;
    }

    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        for (const token of this.expression ?? []) {
            const result = this.lookupOwnSourceValue(position, token);
            if (result) return result;
        }
        return this.lookupOwnSourceValue(position, this.keyword);
    }

    override dumpLabel(): string {
        return this.expression ? `ReturnStatement(${statementTokenText(this.expression)})`
            : 'ReturnStatement';
    }

    override getChildren(): readonly AstNode[] { return []; }
}
