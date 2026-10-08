// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from '../../astKind';
import { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';

import { SourceValue } from '../../../core/sourceValue';

import { DocumentationProvider } from '../../../documentation/documentationProvider';
import { InitElementDocumentationProvider } from '../../../documentation/problem/declarations/initElementDocumentationProvider';

import { ClockConstantNode } from '../expressions/clockConstantNode';
import { ConstantFixedExpressionNode } from '../expressions/constantFixedExpressionNode';
import { DurationConstantNode } from '../expressions/durationConstantNode';
import { SignedConstantExpressionNode } from '../expressions/signedConstantExpressionNode';

export type InitElementValue =
    | {
        readonly kind: 'constantFixedExpression';
        readonly expression: ConstantFixedExpressionNode;
    }
    | {
        readonly kind: 'identifier';
        readonly identifier: SourceValue<string>;
    }
    | {
        readonly kind: 'floatingPoint';
        readonly literal: SourceValue<string>;
    }
    | {
        readonly kind: 'characterString';
        readonly literal: SourceValue<string>;
    }
    | {
        readonly kind: 'bitString';
        readonly literal: SourceValue<string>;
    }
    | {
        readonly kind: 'clock';
        readonly constant: ClockConstantNode;
    }
    | {
        readonly kind: 'duration';
        readonly constant: DurationConstantNode;
    }
    | {
        readonly kind: 'signedConstantExpression';
        readonly expression: SignedConstantExpressionNode;
    };

export class InitElementNode extends AstNode {
    private static readonly provider =
        new InitElementDocumentationProvider();

    constructor(
        public readonly value: InitElementValue
    ) {
        super(AstKind.InitElement);

        switch (value.kind) {
            case 'constantFixedExpression':
                this.adopt(value.expression);
                break;

            case 'clock':
            case 'duration':
                this.adopt(value.constant);
                break;

            case 'signedConstantExpression':
                this.adopt(value.expression);
                break;
        }
    }

    override documentationProvider():
        DocumentationProvider<InitElementNode> {
        return InitElementNode.provider;
    }

    override lookupSourceValue(
        offset: number
    ): AstLookupResult | undefined {
        switch (this.value.kind) {
            case 'constantFixedExpression':
                return this.value.expression.lookupSourceValue(offset);

            case 'identifier':
                return this.lookupOwnSourceValue(
                    offset,
                    this.value.identifier
                );

            case 'floatingPoint':
            case 'characterString':
            case 'bitString':
                return this.lookupOwnSourceValue(
                    offset,
                    this.value.literal
                );

            case 'clock':
            case 'duration':
                return this.value.constant.lookupSourceValue(offset);

            case 'signedConstantExpression':
                return this.value.expression.lookupSourceValue(offset);
        }
    }

    public override dumpLabel(): string {
        switch (this.value.kind) {
            case 'constantFixedExpression':
                return 'InitElement(constant FIXED expression)';

            case 'identifier':
                return `InitElement(identifier ${this.value.identifier.value})`;

            case 'floatingPoint':
                return `InitElement(FLOAT ${this.value.literal.value})`;

            case 'characterString':
                return `InitElement(CHAR ${this.value.literal.value})`;

            case 'bitString':
                return `InitElement(BIT ${this.value.literal.value})`;

            case 'clock':
                return 'InitElement(CLOCK)';

            case 'duration':
                return 'InitElement(DURATION)';

            case 'signedConstantExpression':
                return 'InitElement(signed constant expression)';
        }
    }

    public override getChildren(): readonly AstNode[] {
        switch (this.value.kind) {
            case 'constantFixedExpression':
                return [this.value.expression];

            case 'clock':
            case 'duration':
                return [this.value.constant];

            case 'signedConstantExpression':
                return [this.value.expression];

            default:
                return [];
        }
    }
}
