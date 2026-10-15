// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ParserBase } from "../../parserBase";

import { DclDeclarationNode } from "../../../ast/problem/declarations/dclDeclarationNode";
import { DclDeclarationSentenceNode } from "../../../ast/problem/declarations/dclDeclarationSentenceNode";

import { DclDeclarationSentenceParser } from "./dclDeclarationSentenceParser";

export class DclDeclarationParser extends ParserBase {

    override parse(): DclDeclarationNode | undefined {
        this.skipTrivia();

        const keyword = this.acceptKeyword([
            "DCL",
            "DECLARE"
        ]);

        if (!keyword) {
            return undefined;
        }

        const declarations: DclDeclarationSentenceNode[] = [];
        const firstCheckpoint = this.problemCheckpoint();
        const first = new DclDeclarationSentenceParser(
            this.context
        ).parse();

        if (!first) {
            if (!this.hasProblemsSince(firstCheckpoint)) {
                this.problems.error(
                    this.location(),
                    "Expected declaration after DCL."
                );
            }

            this.synchronize([
                ";"
            ]);
        } else {
            declarations.push(first);

            while (this.acceptComma()) {
                const checkpoint = this.problemCheckpoint();
                const declaration = new DclDeclarationSentenceParser(
                    this.context
                ).parse();

                if (!declaration) {
                    if (!this.hasProblemsSince(checkpoint)) {
                        this.problems.error(
                            this.location(),
                            "Expected declaration after ','."
                        );
                    }

                    this.synchronize([
                        ";"
                    ]);

                    break;
                }

                declarations.push(declaration);
            }
        }

        if (!this.expectSemicolon()) {
            declarations.length = 0;

            if (!this.isIdentifier()) {
                this.synchronize([
                    ";",
                    "TYPE",
                    "DCL",
                    "DECLARE",
                    "SPC",
                    "SPECIFY",
                    "END",
                    "MODEND"
                ]);
            }

            this.acceptSemicolon();
        }

        return new DclDeclarationNode(
            this.tokenValue(keyword),
            declarations
        );
    }
}
