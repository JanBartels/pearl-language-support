// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceOffset } from '../../../core/sourceOffset';
import { SourceValue } from '../../../core/sourceValue';
import { AstKind } from '../../astKind';
import { LiteralExpressionDocumentationProvider } from '../../../documentation/problem/expressions/literalExpressionDocumentationProvider';
import { DocumentationProvider } from '../../../documentation/documentationProvider';
import { AstLookupResult } from '../../astLookupResult';
import { ExpressionNode } from './expressionNode';

export class LiteralExpressionNode extends ExpressionNode {
    private static readonly provider = new LiteralExpressionDocumentationProvider();

    constructor(
        public readonly literal: SourceValue<string>,
        public readonly precision?: SourceValue<string>,
        public readonly openPrecision?: SourceValue<string>,
        public readonly closePrecision?: SourceValue<string>
    ) { super(AstKind.LiteralExpression); }

    override documentationProvider(): DocumentationProvider<LiteralExpressionNode> {
        return LiteralExpressionNode.provider;
    }

    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        return this.lookupOwnSourceValue(position, this.literal)
            ?? this.lookupOwnSourceValue(position, this.openPrecision)
            ?? this.lookupOwnSourceValue(position, this.precision)
            ?? this.lookupOwnSourceValue(position, this.closePrecision);
    }

    override dumpLabel(): string {
        return `LiteralExpression(${this.literal.value}${this.precision ? `(${this.precision.value})` : ''})`;
    }
}
