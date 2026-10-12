// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ParserBase } from "../../parserBase";

import { DclDeclarationSentenceNode } from "../../../ast/problem/declarations/dclDeclarationSentenceNode";

import { DimensionAttributeParser } from "../dimensions/dimensionAttributeParser";
import { OneIdentifierOrListParser } from "../identifiers/oneIdentifierOrListParser";

import { DclAttributeParser } from "./dclAttributeParser";

export class DclDeclarationSentenceParser extends ParserBase {

    override parse(): DclDeclarationSentenceNode | undefined {
        this.skipTrivia();

        const identifiers = new OneIdentifierOrListParser(
            this.context
        ).parse();

        if (!identifiers) {
            return undefined;
        }

        const dimension = new DimensionAttributeParser(
            this.context
        ).parse();

        const checkpoint = this.problemCheckpoint();
        const attribute = new DclAttributeParser(
            this.context
        ).parse();

        if (!attribute) {
            if (!this.hasProblemsSince(checkpoint)) {
                this.problems.error(
                    this.location(),
                    "Expected declaration attribute."
                );
            }

            this.synchronize([
                ",",
                ";"
            ]);

            return undefined;
        }

        return new DclDeclarationSentenceNode(
            identifiers,
            dimension,
            attribute
        );
    }
}
