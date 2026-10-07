// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ParserBase } from "../../parserBase";

import { StructComponentNode } from "../../../ast/problem/types/structComponentNode";

import { OneIdentifierOrListParser } from "../identifiers/oneIdentifierOrListParser";
import { DimensionAttributeParser } from "../dimensions/dimensionAttributeParser";

import { ProblemDataTypeParser } from "./problemDataTypeParser";

export class StructComponentParser extends ParserBase {

    override parse(): StructComponentNode | undefined {

        this.skipTrivia();

        const identifiers =
            new OneIdentifierOrListParser(
                this.context
            ).parse();

        if (!identifiers) {
            return undefined;
        }

        const dimension =
            new DimensionAttributeParser(
                this.context
            ).parse();

        const type =
            new ProblemDataTypeParser(
                this.context
            ).parse();

        if (!type) {

            this.problems.error(
                this.location(),
                "Expected type of structure component."
            );

            this.synchronize([
                ",",
                "]"
            ]);

            return undefined;
        }

        return new StructComponentNode(
            identifiers,
            dimension,
            type
        );
    }
}
