// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from "../core/sourceValue";

import { ConstantFixedExpressionNode } from "../ast/problem/expressions/constantFixedExpressionNode";
import { ConstantFixedTermNode } from "../ast/problem/expressions/constantFixedTermNode";
import { ConstantFixedFactorNode } from "../ast/problem/expressions/constantFixedFactorNode";

import { Environment } from "./environment";


export interface ConstantFixedExpressionEvaluatorContext {

    resolveConstantFixedIdentifier(
        identifier: SourceValue<string>,
        environment: Environment
    ): number | undefined;
}


export class ConstantFixedExpressionEvaluator {

    constructor(
        private readonly context: ConstantFixedExpressionEvaluatorContext
    ) {
    }


    evaluate(
        expression: ConstantFixedExpressionNode,
        environment: Environment
    ): number | undefined {

        let value = this.evaluateTerm( expression.firstTerm, environment );

        if (value === undefined) {
            return undefined;
        }

        for (const tail of expression.tails) {

            const right = this.evaluateTerm( tail.term, environment );

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

            if (!Number.isSafeInteger(value)) {
                return undefined;
            }
        }

        return value;
    }


    private evaluateTerm(
        term: ConstantFixedTermNode,
        environment: Environment
    ): number | undefined {

        let value = this.evaluateFactor( term.firstFactor, environment );

        if (value === undefined) {
            return undefined;
        }

        for (const tail of term.tails) {

            const right = this.evaluateFactor( tail.factor, environment );

            if (right === undefined) {
                return undefined;
            }

            switch (tail.operator.value) {

                case "*":
                    value *= right;
                    break;

                case "//":

                    if (right === 0) {
                        return undefined;
                    }

                    value = Math.trunc(value / right);
                    break;

                case "REM":

                    if (right === 0) {
                        return undefined;
                    }

                    value %= right;
                    break;

                default:
                    return undefined;
            }

            if (!Number.isSafeInteger(value)) {
                return undefined;
            }
        }

        return value;
    }


    private evaluateFactor(
        factor: ConstantFixedFactorNode,
        environment: Environment
    ): number | undefined {

        let value = this.evaluateOperand( factor, environment );

        if (value === undefined) {
            return undefined;
        }

        if (factor.sign?.value === "-") {
            value = -value;
        }

        if (!Number.isSafeInteger(value)) {
            return undefined;
        }

        /*
         * FIT werten wir noch nicht aus.
         *
         * Die Syntax ist bereits vollständig im AST vorhanden, aber die
         * Semantik von FIT gehört in einen eigenen Schritt. Insbesondere
         * sollen wir hier nicht stillschweigend einen falschen Wert liefern.
         */
        if (factor.fit) {
            return undefined;
        }

        return value;
    }


    private evaluateOperand(
        factor: ConstantFixedFactorNode,
        environment: Environment
    ): number | undefined {

        switch (factor.operand.kind) {

            case "integer": {

                const value = Number(factor.operand.literal.value);

                if (!Number.isSafeInteger(value)) {
                    return undefined;
                }

                return value;
            }

            case "identifier":
                return this.context.resolveConstantFixedIdentifier(
                    factor.operand.identifier,
                    environment
                );

            case "parenthesized":
                return this.evaluate(
                    factor.operand.expression,
                    environment
                );

            case "toFixedCharacter":
            case "toFixedBit":

                /*
                 * TOFIXED wird später ergänzt.
                 *
                 * Auch hier lieber "noch nicht auswertbar" als eine
                 * semantisch falsche Näherung.
                 */
                return undefined;
        }
    }
}
