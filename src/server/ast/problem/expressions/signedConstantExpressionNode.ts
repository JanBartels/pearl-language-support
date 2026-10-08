// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from '../../astKind';
import { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';
import { SourceValue } from '../../../core/sourceValue';
import { DocumentationProvider } from '../../../documentation/documentationProvider';
import { SignedConstantExpressionDocumentationProvider } from '../../../documentation/problem/expressions/signedConstantExpressionDocumentationProvider';
import { DurationConstantNode } from './durationConstantNode';

export type SignedConstantExpressionOperand =
    | {
        readonly kind: 'floatingPoint';
        readonly literal: SourceValue<string>;
    }
    | {
        readonly kind: 'duration';
        readonly constant: DurationConstantNode;
    };

export class SignedConstantExpressionNode extends AstNode {
    private static readonly provider =
        new SignedConstantExpressionDocumentationProvider();

    constructor(
        public readonly sign: SourceValue<string>,
        public readonly operand: SignedConstantExpressionOperand
    ) {
        super(AstKind.SignedConstantExpression);

        if (operand.kind === 'duration') {
            this.adopt(operand.constant);
        }
    }

    override documentationProvider():
        DocumentationProvider<SignedConstantExpressionNode> {
        return SignedConstantExpressionNode.provider;
    }

    override lookupSourceValue(
        offset: number
    ): AstLookupResult | undefined {
        const sign = this.lookupOwnSourceValue(offset, this.sign);

        if (sign) {
            return sign;
        }

        switch (this.operand.kind) {
            case 'floatingPoint':
                return this.lookupOwnSourceValue(offset, this.operand.literal);

            case 'duration':
                for (const component of this.operand.constant.components) {
                    const result = this.lookupOwnSourceValue(offset, component.value)
                        ?? this.lookupOwnSourceValue(offset, component.unit);

                    if (result) {
                        return result;
                    }
                }

                return undefined;
        }
    }

    public override dumpLabel(): string {
        return `SignedConstantExpression(${this.sign.value}${this.operand.kind === 'duration' ? 'DURATION' : 'FLOAT'})`;
    }

    public override getChildren(): readonly AstNode[] {
        return this.operand.kind === 'duration'
            ? [this.operand.constant]
            : [];
    }
}
