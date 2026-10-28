// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceOffset } from '../../../core/sourceOffset';
import { SourceValue } from '../../../core/sourceValue';
import { AstKind } from '../../astKind';
import { ParenthesizedExpressionDocumentationProvider } from '../../../documentation/problem/expressions/parenthesizedExpressionDocumentationProvider';
import { DocumentationProvider } from '../../../documentation/documentationProvider';
import { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';
import { ExpressionNode } from './expressionNode';

export class ParenthesizedExpressionNode extends ExpressionNode {
    private static readonly provider = new ParenthesizedExpressionDocumentationProvider();

    constructor(
        public readonly openParenthesis: SourceValue<string>,
        public readonly expression: ExpressionNode | undefined,
        public readonly closeParenthesis?: SourceValue<string>
    ) {
        super(AstKind.ParenthesizedExpression);
        if (expression) this.adopt(expression);
    }

    override documentationProvider(): DocumentationProvider<ParenthesizedExpressionNode> {
        return ParenthesizedExpressionNode.provider;
    }

    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        return this.lookupOwnSourceValue(position, this.openParenthesis)
            ?? this.expression?.lookupSourceValue(position)
            ?? this.lookupOwnSourceValue(position, this.closeParenthesis);
    }

    override getChildren(): readonly AstNode[] { return this.expression ? [this.expression] : []; }
}
