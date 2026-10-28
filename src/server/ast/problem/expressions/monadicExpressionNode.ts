// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceOffset } from '../../../core/sourceOffset';
import { SourceValue } from '../../../core/sourceValue';
import { AstKind } from '../../astKind';
import { MonadicExpressionDocumentationProvider } from '../../../documentation/problem/expressions/monadicExpressionDocumentationProvider';
import { DocumentationProvider } from '../../../documentation/documentationProvider';
import { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';
import { ExpressionNode } from './expressionNode';

export class MonadicExpressionNode extends ExpressionNode {
    private static readonly provider = new MonadicExpressionDocumentationProvider();

    constructor(
        public readonly operator: SourceValue<string>,
        public readonly operand: ExpressionNode | undefined
    ) {
        super(AstKind.MonadicExpression);
        if (operand) this.adopt(operand);
    }

    override documentationProvider(): DocumentationProvider<MonadicExpressionNode> {
        return MonadicExpressionNode.provider;
    }

    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        return this.lookupOwnSourceValue(position, this.operator)
            ?? this.operand?.lookupSourceValue(position);
    }

    override getChildren(): readonly AstNode[] { return this.operand ? [this.operand] : []; }

    override dumpLabel(): string { return `MonadicExpression(${this.operator.value})`; }
}
