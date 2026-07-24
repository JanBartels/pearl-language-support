// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ParserBase } from "../../parserBase";

import { ConstantFixedExpressionNode } from "../../../ast/problem/expressions/constantFixedExpressionNode";

export class ConstantFixedExpressionParser extends ParserBase {

    override parse(): ConstantFixedExpressionNode | undefined {

        this.skipTrivia();

        const literal = this.acceptNumberLiteral();
        if (!literal) {
            return undefined;
        }

        return new ConstantFixedExpressionNode(
            this.tokenValue(literal)
        );
    }

}
