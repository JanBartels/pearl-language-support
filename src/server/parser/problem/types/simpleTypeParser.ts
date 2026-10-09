// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ParserBase } from "../../parserBase";

import { SimpleTypeNode } from "../../../ast/problem/types/simpleTypeNode";
import { ConstantFixedExpressionNode } from "../../../ast/problem/expressions/constantFixedExpressionNode";

import { ConstantFixedExpressionParser } from "../expressions/constantFixedExpressionParser";

const SIMPLE_TYPES = [
    "FIXED",
    "FLOAT",
    "BIT",
    "CHAR",
    "CHARACTER",
    "CLOCK",
    "DUR",
    "DURATION"
] as const;

export class SimpleTypeParser extends ParserBase {

    override parse(): SimpleTypeNode | undefined {

        this.skipTrivia();

        const keyword = this.acceptKeyword(SIMPLE_TYPES);
        if (!keyword) {
            return undefined;
        }

        const keywordText = this.tokenText(keyword);

        let precisionOrLength:
            ConstantFixedExpressionNode | undefined;

        if (
            this.hasOptionalPrecisionOrLength(keywordText)
            && this.acceptLeftParenthesis()
        ) {

            precisionOrLength =
                new ConstantFixedExpressionParser(this.context).parse();

            if (!precisionOrLength) {

                this.problems.error(
                    this.location(),
                    "Expected constant FIXED expression."
                );

                /*
                 * Die öffnende Klammer wurde bereits konsumiert.
                 * Die lokale Produktion ist damit beschädigt.
                 *
                 * Bis zu einem sinnvollen Synchronisationspunkt
                 * vorspulen, damit der aufrufende Parser danach
                 * weiterarbeiten kann.
                 */
                this.synchronize([
                    ")",
                    ",",
                    ";",
                    "TYPE",
                    "DCL",
                    "DECLARE",
                    "SPC",
                    "SPECIFY",
                    "MODEND"
                ]);

                /*
                 * Eine vorhandene schließende Klammer gehört noch
                 * zu dieser Produktion und wird hier konsumiert.
                 *
                 * An anderen Synchronisationspunkten bleibt das
                 * aktuelle Token für den aufrufenden Parser stehen.
                 */
                this.acceptRightParenthesis();

            } else {

                this.expectRightParenthesis();
            }
        }

        return new SimpleTypeNode(
            this.tokenValue(keyword),
            precisionOrLength
        );
    }

    private hasOptionalPrecisionOrLength(
        keyword: string
    ): boolean {

        return keyword === "FIXED"
            || keyword === "FLOAT"
            || keyword === "BIT"
            || keyword === "CHAR"
            || keyword === "CHARACTER";
    }
}
