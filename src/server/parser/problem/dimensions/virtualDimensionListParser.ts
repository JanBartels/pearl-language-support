// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ParserBase } from "../../parserBase";

import { VirtualDimensionListNode } from "../../../ast/problem/dimensions/virtualDimensionListNode";

import { DimensionAttributeParser } from "./dimensionAttributeParser";

export class VirtualDimensionListParser extends ParserBase {

    override parse(): VirtualDimensionListNode | undefined {

        this.skipTrivia();

        const dimensions = [];

        while (true) {

            const dimension =
                new DimensionAttributeParser(this.context).parse();

            if (!dimension) {
                break;
            }

            dimensions.push(dimension);

            if (!this.acceptComma()) {
                break;
            }
        }

        if (dimensions.length === 0) {
            return undefined;
        }

        return new VirtualDimensionListNode(dimensions);
    }

}
