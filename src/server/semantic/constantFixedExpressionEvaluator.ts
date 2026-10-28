// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from "../core/sourceValue";

import { AstNode } from "../ast/astNode";
import { ConstantFixedExpressionNode } from "../ast/problem/expressions/constantFixedExpressionNode";
import { ConstantFixedTermNode } from "../ast/problem/expressions/constantFixedTermNode";
import { ConstantFixedFactorNode } from "../ast/problem/expressions/constantFixedFactorNode";
import { AstKind } from '../ast/astKind';
import type { ExpressionNode } from '../ast/problem/expressions/expressionNode';
import { LiteralExpressionNode } from '../ast/problem/expressions/literalExpressionNode';
import { NameExpressionNode } from '../ast/problem/expressions/nameExpressionNode';
import { ParenthesizedExpressionNode } from '../ast/problem/expressions/parenthesizedExpressionNode';
import { MonadicExpressionNode } from '../ast/problem/expressions/monadicExpressionNode';
import { DyadicExpressionNode } from '../ast/problem/expressions/dyadicExpressionNode';

import { Environment } from "./environment";


export interface ConstantFixedExpressionEvaluatorContext {

    resolveConstantFixedIdentifier(
        identifier: SourceValue<string>,
        environment: Environment
    ): bigint | undefined;

    recordConstantFixedValue(
        node: AstNode,
        value: bigint
    ): void;

    /** Lookup without diagnostics: a nonconstant index is perfectly valid. */
    tryResolveConstantFixedIdentifier(
        identifier: SourceValue<string>,
        environment: Environment
    ): bigint | undefined;
}


export class ConstantFixedExpressionEvaluator {

    constructor(
        private readonly context: ConstantFixedExpressionEvaluatorContext
    ) {
    }


    evaluate(
        expression: ConstantFixedExpressionNode,
        environment: Environment
    ): bigint | undefined {

        let value = this.evaluateTerm(expression.firstTerm, environment);

        if (value === undefined) {
            return undefined;
        }

        for (const tail of expression.tails) {
            const right = this.evaluateTerm(tail.term, environment);

            if (right === undefined) {
                return undefined;
            }

            const result = this.fixedOperation(tail.operator.value, value, right);
            if (result === undefined) return undefined;
            value = result;
        }

        this.context.recordConstantFixedValue(expression, value);
        return value;
    }


    /**
     * Best-effort constant evaluation for the general expression AST.
     * This deliberately reuses the FIXED operation rules of the INIT evaluator,
     * but never reports errors: a runtime-dependent index is not an error.
     */
    tryEvaluateExpression(expression: ExpressionNode | undefined, environment: Environment): bigint | undefined {
        if (!expression) return undefined;
        switch (expression.kind) {
            case AstKind.LiteralExpression: {
                const literal = expression as LiteralExpressionNode;
                return /^\d+$/.test(literal.literal.value)
                    ? this.parseIntegerLiteral(literal.literal.value) : undefined;
            }
            case AstKind.NameExpression: {
                const name = expression as NameExpressionNode;
                return name.segments.length === 1 && !name.segments[0].suffix
                    ? this.context.tryResolveConstantFixedIdentifier(name.segments[0].identifier, environment)
                    : undefined;
            }
            case AstKind.ParenthesizedExpression:
                return this.tryEvaluateExpression(
                    (expression as ParenthesizedExpressionNode).expression, environment);
            case AstKind.MonadicExpression: {
                const unary = expression as MonadicExpressionNode;
                const value = this.tryEvaluateExpression(unary.operand, environment);
                if (value === undefined) return undefined;
                if (unary.operator.value === '+') return value;
                if (unary.operator.value === '-') return -value;
                return undefined;
            }
            case AstKind.DyadicExpression: {
                const binary = expression as DyadicExpressionNode;
                const left = this.tryEvaluateExpression(binary.left, environment);
                const right = this.tryEvaluateExpression(binary.right, environment);
                return left !== undefined && right !== undefined
                    ? this.fixedOperation(binary.operator.value, left, right) : undefined;
            }
            default:
                return undefined;
        }
    }

    /** Shared arithmetic for constant FIXED and general expressions. */
    private fixedOperation(operator: string, left: bigint, right: bigint): bigint | undefined {
        switch (operator) {
            case '+': return left + right;
            case '-': return left - right;
            case '*': return left * right;
            case '//': return right !== BigInt(0) ? left / right : undefined;
            case 'REM': return right !== BigInt(0) ? left % right : undefined;
            default: return undefined;
        }
    }

    private evaluateTerm(
        term: ConstantFixedTermNode,
        environment: Environment
    ): bigint | undefined {

        let value = this.evaluateFactor(term.firstFactor, environment);

        if (value === undefined) {
            return undefined;
        }

        for (const tail of term.tails) {
            const right = this.evaluateFactor(tail.factor, environment);

            if (right === undefined) {
                return undefined;
            }

            const result = this.fixedOperation(tail.operator.value, value, right);
            if (result === undefined) return undefined;
            value = result;
        }

        this.context.recordConstantFixedValue(term, value);
        return value;
    }


    private evaluateFactor(
        factor: ConstantFixedFactorNode,
        environment: Environment
    ): bigint | undefined {

        let value = this.evaluateOperand(factor, environment);

        if (value === undefined) {
            return undefined;
        }

        if (factor.sign?.value === "-") {
            value = -value;
        }

        /*
         * FIT wird in einem eigenen Semantikschritt ergänzt. Die Syntax ist bereits im AST vorhanden,
         * aber ohne die exakte FIT-Semantik soll hier kein scheinbar gültiger Wert entstehen.
         */
        if (factor.fit) {
            return undefined;
        }

        this.context.recordConstantFixedValue(factor, value);
        return value;
    }


    private evaluateOperand(
        factor: ConstantFixedFactorNode,
        environment: Environment
    ): bigint | undefined {

        switch (factor.operand.kind) {
            case "integer":
                return this.parseIntegerLiteral(factor.operand.literal.value);

            case "identifier":
                return this.context.resolveConstantFixedIdentifier(
                    factor.operand.identifier,
                    environment
                );

            case "parenthesized":
                return this.evaluate(factor.operand.expression, environment);

            case "toFixedCharacter":
            case "toFixedBit":
                /* TOFIXED wird später ergänzt. */
                return undefined;
        }
    }


    private parseIntegerLiteral(value: string): bigint | undefined {
        try {
            if (/^[01]+B$/i.test(value)) {
                return BigInt(`0b${value.slice(0, -1)}`);
            }

            return BigInt(value);
        } catch {
            return undefined;
        }
    }
}
