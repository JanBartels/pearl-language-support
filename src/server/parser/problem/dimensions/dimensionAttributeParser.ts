// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ParserBase } from "../../parserBase";

import { DimensionAttributeNode } from "../../../ast/problem/dimensions/dimensionAttributeNode";

import { DimensionBoundariesParser } from "./dimensionBoundariesParser";

export class DimensionAttributeParser extends ParserBase {

    override parse(): DimensionAttributeNode | undefined {

        this.skipTrivia();

        const keyword = this.acceptKeyword("DIM");
        if (!keyword) {
            return undefined;
        }

        this.expectLeftParenthesis();

        const dimensions = [];

        while (true) {

            const dimension =
                new DimensionBoundariesParser(this.context).parse();

            if (!dimension) {
                break;
            }

            dimensions.push(dimension);

            if (!this.acceptComma()) {
                break;
            }
        }

        this.expectRightParenthesis();

        return new DimensionAttributeNode(
            this.tokenValue(keyword),
            dimensions
        );
    }

}
