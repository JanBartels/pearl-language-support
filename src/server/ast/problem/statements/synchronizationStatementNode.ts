// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../../core/sourceValue';
import { SourceOffset } from '../../../core/sourceOffset';
import { AstKind } from '../../astKind';
import { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';
import { NameExpressionNode } from '../expressions/nameExpressionNode';

export type SynchronizationOperation =
    'REQUEST' | 'RELEASE' | 'ENTER' | 'LEAVE' | 'RESERVE' | 'FREE';

/** SynchronizationOperation NameExpression (',' NameExpression)* ';'. */
import { DocumentationProvider } from '../../../documentation/documentationProvider';
import { SynchronizationStatementDocumentationProvider } from '../../../documentation/problem/statements/synchronizationStatementDocumentationProvider';

export class SynchronizationStatementNode extends AstNode {
    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly operands: readonly NameExpressionNode[],
        public readonly commas: readonly SourceValue<string>[]
    ) {
        super(AstKind.SynchronizationStatement);
        this.adoptAll(operands);
    }

    private static readonly provider = new SynchronizationStatementDocumentationProvider();

    override documentationProvider(): DocumentationProvider<SynchronizationStatementNode> {
        return SynchronizationStatementNode.provider;
    }

    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        const own = this.lookupOwnSourceValue(position, this.keyword);
        if (own) return own;
        for (const operand of this.operands) {
            const match = operand.lookupSourceValue(position);
            if (match) return match;
        }
        for (const comma of this.commas) {
            const match = this.lookupOwnSourceValue(position, comma);
            if (match) return match;
        }
        return undefined;
    }

    override getChildren(): readonly AstNode[] { return this.operands; }

    override dumpLabel(): string {
        return `SynchronizationStatement(${this.keyword.value}, ${this.operands.length})`;
    }
}
