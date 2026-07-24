// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ParserBase } from "../../parserBase";

import { DimensionBoundariesNode } from "../../../ast/problem/dimensions/dimensionBoundariesNode";

import { ConstantFixedExpressionParser } from "../expressions/constantFixedExpressionParser";

export class DimensionBoundariesParser extends ParserBase {

    override parse(): DimensionBoundariesNode | undefined {

        this.skipTrivia();

        const first =
            new ConstantFixedExpressionParser(this.context).parse();

        if (!first) {
            return undefined;
        }

        if (!this.acceptColon()) {

            return new DimensionBoundariesNode(
                undefined,
                first
            );
        }

        const second =
            new ConstantFixedExpressionParser(this.context).parse();

        if (!second) {
            return undefined;
        }

        return new DimensionBoundariesNode(
            first,
            second
        );
    }

}
