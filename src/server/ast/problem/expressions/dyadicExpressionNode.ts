// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceOffset } from '../../../core/sourceOffset';
import { SourceValue } from '../../../core/sourceValue';
import { AstKind } from '../../astKind';
import { DyadicExpressionDocumentationProvider } from '../../../documentation/problem/expressions/dyadicExpressionDocumentationProvider';
import { DocumentationProvider } from '../../../documentation/documentationProvider';
import { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';
import { ExpressionNode } from './expressionNode';

export class DyadicExpressionNode extends ExpressionNode {
    private static readonly provider = new DyadicExpressionDocumentationProvider();

    constructor(
        public readonly left: ExpressionNode,
        public readonly operator: SourceValue<string>,
        public readonly right: ExpressionNode | undefined
    ) {
        super(AstKind.DyadicExpression);
        this.adopt(left);
        if (right) this.adopt(right);
    }

    override documentationProvider(): DocumentationProvider<DyadicExpressionNode> {
        return DyadicExpressionNode.provider;
    }

    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        return this.left.lookupSourceValue(position)
            ?? this.lookupOwnSourceValue(position, this.operator)
            ?? this.right?.lookupSourceValue(position);
    }

    override getChildren(): readonly AstNode[] {
        return this.right ? [this.left, this.right] : [this.left];
    }

    override dumpLabel(): string { return `DyadicExpression(${this.operator.value})`; }
}
