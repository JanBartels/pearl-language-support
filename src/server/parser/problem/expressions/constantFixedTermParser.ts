// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ParserBase } from "../../parserBase";

import {
    ConstantFixedTermNode,
    ConstantFixedTermTail
} from "../../../ast/problem/expressions/constantFixedTermNode";

import { ConstantFixedFactorParser } from "./constantFixedFactorParser";

export class ConstantFixedTermParser extends ParserBase {

    override parse(): ConstantFixedTermNode | undefined {

        this.skipTrivia();

        const firstFactor =
            new ConstantFixedFactorParser(
                this.context
            ).parse();

        if (!firstFactor) {
            return undefined;
        }

        const tails: ConstantFixedTermTail[] = [];

        while (true) {

            this.skipTrivia();

            const operator =
                this.acceptOperator(["*", "//"])
                ?? this.acceptKeyword("REM");

            if (!operator) {
                break;
            }

            const factor =
                new ConstantFixedFactorParser(
                    this.context
                ).parse();

            if (!factor) {
                this.problems.error(
                    this.location(),
                    `Expected constant FIXED factor after '${this.tokenText(operator)}'.`
                );
                break;
            }

            tails.push({
                operator: this.tokenValue(operator),
                factor
            });
        }

        return new ConstantFixedTermNode(
            firstFactor,
            tails
        );
    }

}
