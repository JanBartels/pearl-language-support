// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ParserBase } from "../../parserBase";

import { DclDeclarationSentenceNode } from "../../../ast/problem/declarations/dclDeclarationSentenceNode";

import { OneIdentifierOrListParser } from "../identifiers/oneIdentifierOrListParser";
import { DimensionAttributeParser } from "../dimensions/dimensionAttributeParser";

import { DclAttributeParser } from "./dclAttributeParser";

export class DclDeclarationSentenceParser extends ParserBase {

    override parse():
        DclDeclarationSentenceNode | undefined {

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

        const attribute =
            new DclAttributeParser(
                this.context
            ).parse();

        if (!attribute) {

            this.problems.error(
                this.location(),
                "Expected declaration attribute."
            );

            this.synchronize([
                ",",
                ";"
            ]);
        }

        return new DclDeclarationSentenceNode(
            identifiers,
            dimension,
            attribute
        );
    }

}
