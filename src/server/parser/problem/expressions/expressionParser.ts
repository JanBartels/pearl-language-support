// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ExpressionNode } from '../../../ast/problem/expressions/expressionNode';
import { DyadicExpressionNode } from '../../../ast/problem/expressions/dyadicExpressionNode';
import { MonadicExpressionNode } from '../../../ast/problem/expressions/monadicExpressionNode';
import { ParenthesizedExpressionNode } from '../../../ast/problem/expressions/parenthesizedExpressionNode';
import { LiteralExpressionNode } from '../../../ast/problem/expressions/literalExpressionNode';
import { ParserBase } from '../../parserBase';
import { Token, TokenKind } from '../../../lexer/token';
import { SourceValue } from '../../../core/sourceValue';
import { NameExpressionParser } from './nameExpressionParser';

/** Operator ranks from PEARL 90, section 6.1.3, Table 6.10.
 * Larger binding power means higher precedence. Rank 1 associates to the
 * right, while ranks 2-7 associate to the left. Syntax only, no type checks.
 */
const DYADIC_OPERATORS: ReadonlyMap<string, { power: number; rightAssociative: boolean }> =
    new Map<string, { power: number; rightAssociative: boolean }>([
        ...['**', 'FIT', 'LWB', 'UPB'].map(op => [op, { power: 7, rightAssociative: true }] as const),
        ...['*', '/', '><', '//', 'REM', 'CAT'].map(op => [op, { power: 6, rightAssociative: false }] as const),
        ...['+', '-', '<>', 'SHIFT', 'CSHIFT'].map(op => [op, { power: 5, rightAssociative: false }] as const),
        ...['<', '>', '<=', '>=', 'LT', 'GT', 'LE', 'GE'].map(op => [op, { power: 4, rightAssociative: false }] as const),
        ...['==', '/=', 'IS', 'ISNT', 'EQ', 'NE'].map(op => [op, { power: 3, rightAssociative: false }] as const),
        ['AND', { power: 2, rightAssociative: false }],
        ...['OR', 'EXOR'].map(op => [op, { power: 1, rightAssociative: false }] as const)
    ]);

const MONADIC_OPERATORS = [
    'NOT', 'ABS', 'SIGN', 'LWB', 'UPB', 'SIZEOF', 'CONT',
    'TOFIXED', 'TOFLOAT', 'TOBIT', 'TOCHAR', 'ENTIER', 'ROUND'
] as const;

/** First vertical slice of the general expression grammar.
 * A deliberate standalone parser: statement token preservation and the
 * constant-FIXED-expression grammar are not changed in this milestone.
 * Unimplemented forms (e.g. clock/duration literals and IF expressions)
 * are not silently consumed or guessed.
 */
export class ExpressionParser extends ParserBase {
    override parse(): ExpressionNode | undefined {
        return this.parseWithMinimumPower(1);
    }

    private parseWithMinimumPower(minimumPower: number): ExpressionNode | undefined {
        let left = this.parseMonadicOrOperand();
        if (!left) return undefined;

        while (true) {
            this.skipTrivia();
            const operator = DYADIC_OPERATORS.get(this.tokenText());
            if (!operator || operator.power < minimumPower
                || !(this.isOperator(this.tokenText()) || this.isKeyword(this.tokenText()))) {
                break;
            }

            const operatorToken = this.current();
            this.next();
            const right = this.parseWithMinimumPower(
                operator.rightAssociative ? operator.power : operator.power + 1
            );
            if (!right) {
                this.problems.error(this.location(),
                    `Expected expression after '${this.tokenText(operatorToken)}'.`);
            }
            left = new DyadicExpressionNode(left, this.tokenValue(operatorToken), right);
            if (!right) break;
        }
        return left;
    }

    private parseMonadicOrOperand(): ExpressionNode | undefined {
        this.skipTrivia();
        const operator = this.acceptOperator(['+', '-'])
            ?? this.acceptKeyword(MONADIC_OPERATORS);
        if (operator) {
            // Unary operators have rank 1, but -A**B means -(A**B).
            const operand = this.parseWithMinimumPower(7);
            if (!operand) {
                this.problems.error(this.location(),
                    `Expected operand after '${this.tokenText(operator)}'.`);
            }
            return new MonadicExpressionNode(this.tokenValue(operator), operand);
        }

        const token = this.current();
        if (this.isKeyword('NIL')) {
            this.next();
            return new LiteralExpressionNode(this.tokenValue(token));
        }
        if (this.isKeyword('IF')) {
            this.problems.error(this.location(),
                'Bedingte IF-Ausdrücke werden von RTOS-UH nicht unterstützt.');
            return undefined;
        }
        if (this.isNumberLiteral() || this.isStringLiteral() || this.isBitLiteral()) {
            this.next();
            return this.parseLiteral(this.tokenValue(token),
                this.isNumberToken(token));
        }

        if (this.isOperator('(')) {
            const opening = this.tokenValue(this.current());
            this.next();
            const expression = this.parseWithMinimumPower(1);
            if (!expression) {
                this.problems.error(this.location(), 'Expected expression after opening parenthesis.');
            }
            this.skipTrivia();
            const closingToken = this.acceptOperator(')');
            if (!closingToken) {
                this.problems.error(this.location(), "Expected ')' after expression.");
            }
            return new ParenthesizedExpressionNode(opening, expression,
                closingToken ? this.tokenValue(closingToken) : undefined);
        }

        const identifier = this.acceptIdentifier();
        if (identifier) {
            return new NameExpressionParser(this.context).parseAfterIdentifier(identifier);
        }
        return undefined;
    }

    private isNumberToken(token: Token): boolean {
        return this.tokenKind(token) === TokenKind.IntegerLiteral
            || this.tokenKind(token) === TokenKind.FloatingPointLiteral;
    }

    private parseLiteral(
        literal: SourceValue<string>,
        numeric: boolean
    ): LiteralExpressionNode {
        if (!numeric) return new LiteralExpressionNode(literal);
        this.skipTrivia();
        // Optional precision on numeric literals, e.g. 1(31) or 1.5(55).
        const opening = this.acceptOperator('(');
        if (!opening) return new LiteralExpressionNode(literal);
        this.skipTrivia();
        const precisionToken = this.acceptIntegerLiteral();
        if (!precisionToken) {
            this.problems.error(this.location(), 'Expected numeric literal precision.');
        }
        this.skipTrivia();
        const closing = this.acceptOperator(')');
        if (!closing) {
            this.problems.error(this.location(), "Expected ')' after numeric literal precision.");
        }
        return new LiteralExpressionNode(
            literal,
            precisionToken ? this.tokenValue(precisionToken) : undefined,
            this.tokenValue(opening),
            closing ? this.tokenValue(closing) : undefined
        );
    }
}
