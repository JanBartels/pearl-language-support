// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { SourceValue } from '../../../core/sourceValue';

import { ParserBase } from '../../parserBase';

import { InitElementNode } from '../../../ast/problem/declarations/initElementNode';
import { ConstantFixedExpressionNode } from '../../../ast/problem/expressions/constantFixedExpressionNode';
import { ConstantFixedFactorNode } from '../../../ast/problem/expressions/constantFixedFactorNode';
import {
    SignedConstantExpressionNode,
    SignedConstantExpressionOperand
} from '../../../ast/problem/expressions/signedConstantExpressionNode';

import { ConstantFixedExpressionParser } from '../expressions/constantFixedExpressionParser';
import { ConstantFixedExpressionTailParser } from '../expressions/constantFixedExpressionTailParser';
import { ConstantFixedFactorParser } from '../expressions/constantFixedFactorParser';
import { ConstantFixedTermTailParser } from '../expressions/constantFixedTermTailParser';
import { ClockConstantTailParser } from '../expressions/clockConstantTailParser';
import { DurationConstantTailParser } from '../expressions/durationConstantTailParser';

export class InitElementParser extends ParserBase {
    override parse(): InitElementNode | undefined {
        this.skipTrivia();

        const signToken = this.acceptOperator(['+', '-']);

        if (signToken) {
            return this.parseSignedElement(this.tokenValue(signToken));
        }

        /*
         * FLOAT and DURATION can start with the same floating-point token.
         * Consume the token once and decide from the following SEC keyword.
         */
        const floatingPoint = this.acceptFloatingPointLiteral();

        if (floatingPoint) {
            const literal = this.tokenValue(floatingPoint);

            this.skipTrivia();

            if (this.isKeyword('SEC')) {
                const duration = new DurationConstantTailParser(this.context).parseTail({
                    value: literal,
                    integer: false
                });

                return duration
                    ? new InitElementNode({ kind: 'duration', constant: duration })
                    : undefined;
            }

            return new InitElementNode({
                kind: 'floatingPoint',
                literal
            });
        }

        const characterString = this.acceptStringLiteral();

        if (characterString) {
            return new InitElementNode({
                kind: 'characterString',
                literal: this.tokenValue(characterString)
            });
        }

        const bitString = this.acceptBitLiteral();

        if (bitString) {
            return new InitElementNode({
                kind: 'bitString',
                literal: this.tokenValue(bitString)
            });
        }

        /*
         * An integer prefix is shared by constant FIXED expressions, CLOCK and
         * DURATION. ConstantFixedExpressionParser consumes the common prefix;
         * only a syntactically bare integer can then be reinterpreted as a
         * CLOCK/DURATION prefix.
         */
        const constantFixedExpression =
            new ConstantFixedExpressionParser(this.context).parse();

        if (constantFixedExpression) {
            const integer = this.getBareUnsignedInteger(constantFixedExpression);

            if (integer) {
                this.skipTrivia();

                if (this.isOperator(':')) {
                    const clock = new ClockConstantTailParser(this.context).parseTail(integer);

                    return clock
                        ? new InitElementNode({ kind: 'clock', constant: clock })
                        : undefined;
                }

                if (this.isKeyword(['HRS', 'MIN', 'SEC'])) {
                    const duration = new DurationConstantTailParser(this.context).parseTail({
                        value: integer,
                        integer: true
                    });

                    return duration
                        ? new InitElementNode({ kind: 'duration', constant: duration })
                        : undefined;
                }
            }

            const identifier = this.getBareIdentifier(constantFixedExpression);

            if (identifier) {
                return new InitElementNode({
                    kind: 'identifier',
                    identifier
                });
            }

            return new InitElementNode({
                kind: 'constantFixedExpression',
                expression: constantFixedExpression
            });
        }

        return undefined;
    }

    private parseSignedElement(
        sign: SourceValue<string>
    ): InitElementNode | undefined {
        this.skipTrivia();

        const floatingPoint = this.acceptFloatingPointLiteral();

        if (floatingPoint) {
            const literal = this.tokenValue(floatingPoint);

            this.skipTrivia();

            if (this.isKeyword('SEC')) {
                const duration = new DurationConstantTailParser(this.context).parseTail({
                    value: literal,
                    integer: false
                });

                return duration
                    ? this.signedExpression(sign, {
                        kind: 'duration',
                        constant: duration
                    })
                    : undefined;
            }

            return this.signedExpression(sign, {
                kind: 'floatingPoint',
                literal
            });
        }

        const integer = this.acceptIntegerLiteral();

        if (integer) {
            const literal = this.tokenValue(integer);

            this.skipTrivia();

            if (this.isKeyword(['HRS', 'MIN', 'SEC'])) {
                const duration = new DurationConstantTailParser(this.context).parseTail({
                    value: literal,
                    integer: true
                });

                return duration
                    ? this.signedExpression(sign, {
                        kind: 'duration',
                        constant: duration
                    })
                    : undefined;
            }

            const factor = new ConstantFixedFactorParser(this.context)
                .parseAfterSignedInteger(sign, literal);

            return new InitElementNode({
                kind: 'constantFixedExpression',
                expression: this.parseConstantFixedExpressionTail(factor)
            });
        }

        const factor = new ConstantFixedFactorParser(this.context).parseAfterSign(sign);

        if (!factor) {
            return undefined;
        }

        return new InitElementNode({
            kind: 'constantFixedExpression',
            expression: this.parseConstantFixedExpressionTail(factor)
        });
    }

    private signedExpression(
        sign: SourceValue<string>,
        operand: SignedConstantExpressionOperand
    ): InitElementNode {
        return new InitElementNode({
            kind: 'signedConstantExpression',
            expression: new SignedConstantExpressionNode(sign, operand)
        });
    }

    private parseConstantFixedExpressionTail(
        firstFactor: ConstantFixedFactorNode
    ): ConstantFixedExpressionNode {
        const firstTerm = new ConstantFixedTermTailParser(this.context).parseTail(firstFactor);
        return new ConstantFixedExpressionTailParser(this.context).parseTail(firstTerm);
    }

    private getBareUnsignedInteger(
        expression: ConstantFixedExpressionNode
    ): SourceValue<string> | undefined {
        if (expression.tails.length !== 0) {
            return undefined;
        }

        const term = expression.firstTerm;

        if (term.tails.length !== 0) {
            return undefined;
        }

        const factor = term.firstFactor;

        if (
            factor.sign
            || factor.fit
            || factor.operand.kind !== 'integer'
            || factor.operand.precision
        ) {
            return undefined;
        }

        return factor.operand.literal;
    }

    private getBareIdentifier(
        expression: ConstantFixedExpressionNode
    ): SourceValue<string> | undefined {
        if (expression.tails.length !== 0) {
            return undefined;
        }

        const term = expression.firstTerm;

        if (term.tails.length !== 0) {
            return undefined;
        }

        const factor = term.firstFactor;

        if (factor.sign || factor.fit || factor.operand.kind !== 'identifier') {
            return undefined;
        }

        return factor.operand.identifier;
    }
}
