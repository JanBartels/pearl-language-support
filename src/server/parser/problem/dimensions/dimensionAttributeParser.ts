// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ParserBase } from "../../parserBase";

import { DimensionAttributeNode } from "../../../ast/problem/dimensions/dimensionAttributeNode";
import { DimensionBoundariesNode } from "../../../ast/problem/dimensions/dimensionBoundariesNode";

import { DimensionBoundariesParser } from "./dimensionBoundariesParser";

export class DimensionAttributeParser extends ParserBase {

    override parse(): DimensionAttributeNode | undefined {

        this.skipTrivia();

        if (!this.acceptLeftParenthesis()) {
            return undefined;
        }

        const dimensions:
            DimensionBoundariesNode[] = [];

        const first =
            new DimensionBoundariesParser(
                this.context
            ).parse();

        if (!first) {

            this.problems.error(
                this.location(),
                "Expected dimension boundaries."
            );

            this.synchronize([
                ")"
            ]);

            this.acceptRightParenthesis();

            return new DimensionAttributeNode(
                dimensions
            );
        }

        dimensions.push(first);

        while (this.acceptComma()) {

            const dimension =
                new DimensionBoundariesParser(
                    this.context
                ).parse();

            if (!dimension) {

                this.problems.error(
                    this.location(),
                    "Expected dimension boundaries after ','."
                );

                this.synchronize([
                    ")"
                ]);

                break;
            }

            dimensions.push(dimension);
        }

        if (!this.expectRightParenthesis()) {

            this.synchronize([
                ")"
            ]);

            this.acceptRightParenthesis();
        }

        return new DimensionAttributeNode(
            dimensions
        );
    }

}
