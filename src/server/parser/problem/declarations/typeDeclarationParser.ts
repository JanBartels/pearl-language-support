// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from "../../../core/sourceValue";

import { ParserBase } from "../../parserBase";

import { TypeDeclarationNode } from "../../../ast/problem/declarations/typeDeclarationNode";

import { DimensionAttributeParser } from "../dimensions/dimensionAttributeParser";
import { ProblemDataTypeParser } from "../types/problemDataTypeParser";
import { SimpleTypeParser } from "../types/simpleTypeParser";

export class TypeDeclarationParser extends ParserBase {

    override parse(): TypeDeclarationNode | undefined {

        this.skipTrivia();

        const keyword =
            this.acceptKeyword("TYPE");

        if (!keyword) {
            return undefined;
        }

        const identifier =
            this.expectIdentifier(
                "Expected type name after 'TYPE'."
            );

        const name = identifier
            ? this.tokenValue(identifier)
            : SourceValue.synthetic("<error>");

        if (!identifier) {

            this.synchronize([
                ";"
            ]);

            this.acceptSemicolon();

            return new TypeDeclarationNode(
                this.tokenValue(keyword),
                name,
                undefined,
                undefined
            );
        }

        /*
         * UH-PEARL extension:
         *
         * TYPE Vector(10) FIXED;
         * TYPE Matrix(0:9, 1:20) FLOAT;
         *
         * Without a dimension, the normal PEARL TYPE production
         * currently only accepts a simple type. STRUCT will be
         * added later.
         */
        const dimension =
            new DimensionAttributeParser(
                this.context
            ).parse();

        const type = dimension
            ? new ProblemDataTypeParser(
                this.context
            ).parse()
            : new SimpleTypeParser(
                this.context
            ).parse();

        if (!type) {

            this.problems.error(
                this.location(),
                "Expected type definition."
            );

            this.synchronize([
                ";"
            ]);
        }

        if (!this.expectSemicolon()) {

            this.synchronize([
                ";",
                "TYPE",
                "DCL",
                "DECLARE",
                "MODEND"
            ]);

            this.acceptSemicolon();
        }

        return new TypeDeclarationNode(
            this.tokenValue(keyword),
            name,
            dimension,
            type
        );
    }

}
