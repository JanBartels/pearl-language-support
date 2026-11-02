// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../../core/sourceValue';
import { SourceOffset } from '../../../core/sourceOffset';
import { AstKind } from '../../astKind';
import { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';
import { ExpressionNode } from '../expressions/expressionNode';
import { NameExpressionNode } from '../expressions/nameExpressionNode';

/** RTOS-UH: SEMASET Expression ',' NameExpression ';'. */
import { DocumentationProvider } from '../../../documentation/documentationProvider';
import { SemaSetStatementDocumentationProvider } from '../../../documentation/problem/statements/semaSetStatementDocumentationProvider';

export class SemaSetStatementNode extends AstNode {
    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly value: ExpressionNode | undefined,
        public readonly comma: SourceValue<string> | undefined,
        public readonly sema: NameExpressionNode | undefined
    ) {
        super(AstKind.SemaSetStatement);
        if (value) this.adopt(value);
        if (sema) this.adopt(sema);
    }

    private static readonly provider = new SemaSetStatementDocumentationProvider();

    override documentationProvider(): DocumentationProvider<SemaSetStatementNode> {
        return SemaSetStatementNode.provider;
    }

    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        return this.lookupOwnSourceValue(position, this.keyword)
            ?? this.value?.lookupSourceValue(position)
            ?? this.lookupOwnSourceValue(position, this.comma)
            ?? this.sema?.lookupSourceValue(position);
    }

    override getChildren(): readonly AstNode[] {
        return [this.value, this.sema].filter((node): node is ExpressionNode | NameExpressionNode => !!node);
    }

    override dumpLabel(): string { return 'SemaSetStatement'; }
}
