// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ParserBase } from "../../parserBase";

import { InitElementNode } from "../../../ast/problem/declarations/initElementNode";

import { ConstantFixedExpressionParser } from "../expressions/constantFixedExpressionParser";

export class InitElementParser extends ParserBase {

    override parse(): InitElementNode | undefined {

        this.skipTrivia();

        /*
         * Die allgemeine PEARL-Produktion InitElement ist breiter als der
         * derzeit implementierte Ausdrucksumfang. Die hier bereits sicher
         * unterscheidbaren Literalformen werden direkt übernommen.
         *
         * Vorzeichenbehaftete FLOAT- sowie CLOCK-/DURATION-Konstanten kommen
         * mit dem allgemeinen ConstantExpressionParser hinzu. Ein führendes
         * '+' oder '-' wird hier deshalb bewusst nicht konsumiert: Es kann
         * bereits zu einem ConstantFixedExpression gehören.
         */

        const floatingPoint =
            this.acceptFloatingPointLiteral();

        if (floatingPoint) {
            return new InitElementNode({
                kind: "floatingPoint",
                literal: this.tokenValue(floatingPoint)
            });
        }

        const characterString =
            this.acceptStringLiteral();

        if (characterString) {
            return new InitElementNode({
                kind: "characterString",
                literal: this.tokenValue(characterString)
            });
        }

        const bitString =
            this.acceptBitLiteral();

        if (bitString) {
            return new InitElementNode({
                kind: "bitString",
                literal: this.tokenValue(bitString)
            });
        }

        const constantFixedExpression =
            new ConstantFixedExpressionParser(
                this.context
            ).parse();

        if (constantFixedExpression) {
            return new InitElementNode({
                kind: "constantFixedExpression",
                expression: constantFixedExpression
            });
        }

        return undefined;
    }
}
