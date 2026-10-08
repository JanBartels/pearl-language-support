// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../../core/sourceValue';
import { ParserBase } from '../../parserBase';
import {
    ConstantFixedFactorNode,
    ConstantFixedFactorOperand,
    ConstantFixedFit
} from '../../../ast/problem/expressions/constantFixedFactorNode';
import { ConstantFixedExpressionParser } from './constantFixedExpressionParser';

export class ConstantFixedFactorParser extends ParserBase {
    override parse(): ConstantFixedFactorNode | undefined {
        this.skipTrivia();

        const signToken = this.acceptOperator(['+', '-']);
        const sign = signToken
            ? this.tokenValue(signToken)
            : undefined;

        return this.parseAfterSign(sign);
    }

    parseAfterSign(
        sign: SourceValue<string> | undefined
    ): ConstantFixedFactorNode | undefined {
        const operand = this.parseOperand();

        if (!operand) {
            if (sign) {
                this.problems.error(
                    this.location(),
                    'Expected constant FIXED factor after sign.'
                );
            }

            return undefined;
        }

        return this.parseFactorTail(sign, operand);
    }

    parseAfterSignedInteger(
        sign: SourceValue<string>,
        literal: SourceValue<string>
    ): ConstantFixedFactorNode {
        const operand = this.parseIntegerOperand(literal);
        return this.parseFactorTail(sign, operand);
    }

    private parseOperand(): ConstantFixedFactorOperand | undefined {
        const integer = this.acceptIntegerLiteral();

        if (integer) {
            return this.parseIntegerOperand(this.tokenValue(integer));
        }

        if (this.acceptLeftParenthesis()) {
            const expression = new ConstantFixedExpressionParser(this.context).parse();

            if (!expression) {
                this.problems.error(
                    this.location(),
                    "Expected constant FIXED expression after '('."
                );

                this.expectRightParenthesis();
                return undefined;
            }

            this.expectRightParenthesis(
                "Expected ')' after constant FIXED expression."
            );

            return {
                kind: 'parenthesized',
                expression
            };
        }

        const toFixed = this.acceptKeyword('TOFIXED');

        if (toFixed) {
            this.skipTrivia();

            const parenthesized = this.acceptLeftParenthesis() !== undefined;

            if (parenthesized) {
                this.skipTrivia();
            }

            const character = this.acceptStringLiteral();

            if (character) {
                if (parenthesized) {
                    this.skipTrivia();
                    this.expectRightParenthesis(
                        "Expected ')' after TOFIXED operand."
                    );
                }

                return {
                    kind: 'toFixedCharacter',
                    keyword: this.tokenValue(toFixed),
                    literal: this.tokenValue(character)
                };
            }

            const bit = this.acceptBitLiteral();

            if (bit) {
                if (parenthesized) {
                    this.skipTrivia();
                    this.expectRightParenthesis(
                        "Expected ')' after TOFIXED operand."
                    );
                }

                return {
                    kind: 'toFixedBit',
                    keyword: this.tokenValue(toFixed),
                    literal: this.tokenValue(bit)
                };
            }

            this.problems.error(
                this.location(),
                "Expected character or bit string constant after 'TOFIXED'."
            );

            if (parenthesized) {
                this.synchronize([
                    ')',
                    ',',
                    ';',
                    'TYPE',
                    'DCL',
                    'DECLARE',
                    'MODEND'
                ]);

                this.acceptRightParenthesis();
            }

            return undefined;
        }

        const identifier = this.acceptIdentifier();

        if (identifier) {
            return {
                kind: 'identifier',
                identifier: this.tokenValue(identifier)
            };
        }

        return undefined;
    }

    private parseIntegerOperand(
        literal: SourceValue<string>
    ): ConstantFixedFactorOperand {
        let precision: SourceValue<string> | undefined;

        if (this.acceptLeftParenthesis()) {
            this.skipTrivia();

            const precisionToken = this.expectIntegerLiteral(
                "Expected precision after '('."
            );

            if (precisionToken) {
                precision = this.tokenValue(precisionToken);
            } else {
                this.synchronize([
                    ')',
                    'FIT',
                    '*',
                    '//',
                    'REM',
                    '+',
                    '-',
                    ',',
                    ';',
                    'TYPE',
                    'DCL',
                    'DECLARE',
                    'MODEND'
                ]);
            }

            this.expectRightParenthesis(
                "Expected ')' after precision."
            );
        }

        return {
            kind: 'integer',
            literal,
            precision
        };
    }

    private parseFactorTail(
        sign: SourceValue<string> | undefined,
        operand: ConstantFixedFactorOperand
    ): ConstantFixedFactorNode {
        this.skipTrivia();

        let fit: ConstantFixedFit | undefined;
        const fitKeyword = this.acceptKeyword('FIT');

        if (fitKeyword) {
            const expression = new ConstantFixedExpressionParser(this.context).parse();

            if (!expression) {
                this.problems.error(
                    this.location(),
                    "Expected constant FIXED expression after 'FIT'."
                );
            } else {
                fit = {
                    keyword: this.tokenValue(fitKeyword),
                    expression
                };
            }
        }

        return new ConstantFixedFactorNode(sign, operand, fit);
    }
}
