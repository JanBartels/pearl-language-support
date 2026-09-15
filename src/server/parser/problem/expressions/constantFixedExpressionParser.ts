// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ParserBase } from "../../parserBase";

import {
    ConstantFixedExpressionNode,
    ConstantFixedExpressionTail
} from "../../../ast/problem/expressions/constantFixedExpressionNode";

import { ConstantFixedTermParser } from "./constantFixedTermParser";

export class ConstantFixedExpressionParser extends ParserBase {

    override parse(): ConstantFixedExpressionNode | undefined {

        this.skipTrivia();

        const firstTerm =
            new ConstantFixedTermParser(
                this.context
            ).parse();

        if (!firstTerm) {
            return undefined;
        }

        const tails: ConstantFixedExpressionTail[] = [];

        while (true) {

            this.skipTrivia();

            const operator =
                this.acceptOperator(["+", "-"]);

            if (!operator) {
                break;
            }

            const term =
                new ConstantFixedTermParser(
                    this.context
                ).parse();

            if (!term) {
                this.problems.error(
                    this.location(),
                    `Expected constant FIXED term after '${this.tokenText(operator)}'.`
                );
                break;
            }

            tails.push({
                operator: this.tokenValue(operator),
                term
            });
        }

        return new ConstantFixedExpressionNode(
            firstTerm,
            tails
        );
    }

}
