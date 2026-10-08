// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from "../core/sourceValue";

import { AstNode } from "../ast/astNode";
import { ConstantFixedExpressionNode } from "../ast/problem/expressions/constantFixedExpressionNode";
import { ConstantFixedTermNode } from "../ast/problem/expressions/constantFixedTermNode";
import { ConstantFixedFactorNode } from "../ast/problem/expressions/constantFixedFactorNode";

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

            switch (tail.operator.value) {
                case "+":
                    value += right;
                    break;

                case "-":
                    value -= right;
                    break;

                default:
                    return undefined;
            }
        }

        this.context.recordConstantFixedValue(expression, value);
        return value;
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

            switch (tail.operator.value) {
                case "*":
                    value *= right;
                    break;

                case "//":
                    if (right === BigInt(0)) {
                        return undefined;
                    }

                    value /= right;
                    break;

                case "REM":
                    if (right === BigInt(0)) {
                        return undefined;
                    }

                    value %= right;
                    break;

                default:
                    return undefined;
            }
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
