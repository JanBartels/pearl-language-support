// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from "../../../core/sourceValue";

import { ParserBase } from "../../parserBase";

import { TypeDeclarationNode } from "../../../ast/problem/declarations/typeDeclarationNode";

import { DimensionAttributeParser } from "../dimensions/dimensionAttributeParser";
import { ProblemDataTypeParser } from "../types/problemDataTypeParser";

export class TypeDeclarationParser extends ParserBase {

    override parse(): TypeDeclarationNode | undefined {

        this.skipTrivia();

        const keyword = this.acceptKeyword("TYPE");

        if (!keyword) {
            return undefined;
        }

        const identifier = this.expectIdentifier( "Expected type name after 'TYPE'." );

        const name = identifier
            ? this.tokenValue(identifier)
            : SourceValue.synthetic("<error>");

        if (!identifier) {

            this.synchronize([
                ";",
                "BEGIN",
                "FOR",
                "FROM",
                "BY",
                "TO",
                "WHILE",
                "REPEAT",
                "END",
                "MODEND"
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
         * A dimensioned TYPE may also refer to an already
         * defined named type.
         */
        const dimension = new DimensionAttributeParser( this.context ).parse();

        const type = new ProblemDataTypeParser( this.context ).parse();

        if (!type) {

            this.problems.error( this.location(), "Expected type definition." );

            this.synchronize([
                ";",
                "BEGIN",
                "FOR",
                "FROM",
                "BY",
                "TO",
                "WHILE",
                "REPEAT",
                "END",
                "MODEND"
            ]);
        }

        if (!this.expectSemicolon()) {

            if (!this.isIdentifier()) {
                this.synchronize([
                    ";",
                    "TYPE",
                    "DCL",
                    "DECLARE",
                    "SPC",
                    "SPECIFY",
                    "BEGIN",
                    "FOR",
                    "FROM",
                    "BY",
                    "TO",
                    "WHILE",
                    "REPEAT",
                    "END",
                    "MODEND"
                ]);
            }

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
