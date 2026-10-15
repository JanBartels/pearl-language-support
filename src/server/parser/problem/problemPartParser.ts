// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ParserBase } from "../parserBase";

import { ProblemPartNode } from "../../ast/problem/problemPartNode";

import { TypeDeclarationParser } from "./declarations/typeDeclarationParser";
import { DclDeclarationParser } from "./declarations/dclDeclarationParser";
import { SpcDeclarationParser } from "./specifications/spcDeclarationParser";
import { ProblemNamedDeclarationParser } from "./declarations/problemNamedDeclarationParser";

export class ProblemPartParser extends ParserBase {

    override parse(): ProblemPartNode | undefined {

        this.skipTrivia();

        const problemKeyword =
            this.acceptKeyword("PROBLEM");

        if (!problemKeyword) {
            return undefined;
        }

        const node = new ProblemPartNode(
            this.tokenValue(problemKeyword)
        );

        if (!this.expectSemicolon() && !this.isIdentifier()) {
            this.synchronize([
                "TYPE",
                "DCL",
                "DECLARE",
                "SPC",
                "SPECIFY",
                "MODEND"
            ]);
        }

        while (!this.eof()) {

            this.skipTrivia();

            if (this.isKeyword("MODEND")) {
                break;
            }

            const typeDeclaration =
                new TypeDeclarationParser(
                    this.context
                ).parse();

            if (typeDeclaration) {
                node.addChild(typeDeclaration);
                continue;
            }

            const dclDeclaration =
                new DclDeclarationParser(
                    this.context
                ).parse();

            if (dclDeclaration) {
                node.addChild(dclDeclaration);
                continue;
            }

            const spcDeclaration =
                new SpcDeclarationParser(
                    this.context
                ).parse();

            if (spcDeclaration) {
                node.addChild(spcDeclaration);
                continue;
            }

            if (this.isIdentifier()) {
                const namedDeclaration =
                    new ProblemNamedDeclarationParser(
                        this.context
                    ).parse();

                if (namedDeclaration) {
                    node.addChild(namedDeclaration);
                }

                continue;
            }

            this.problems.error(
                this.location(),
                `Unsupported PROBLEM declaration '${this.tokenText()}'.`
            );

            /*
             * Weitere PROBLEM-Produktionen sind noch nicht
             * implementiert.
             *
             * Nicht tokenweise nach bekannten Produktionen suchen,
             * da sonst beispielsweise TYPE oder DCL innerhalb einer
             * noch nicht geparsten TASK oder PROC fälschlich als
             * Deklaration auf Modulebene erkannt werden könnten.
             */
            this.synchronize([
                "MODEND"
            ]);

            break;
        }

        return node;
    }
}
