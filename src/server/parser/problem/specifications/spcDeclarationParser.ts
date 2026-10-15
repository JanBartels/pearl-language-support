// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SpcDeclarationNode } from "../../../ast/problem/specifications/spcDeclarationNode";
import { SpcDeclarationSentenceNode } from "../../../ast/problem/specifications/spcDeclarationSentenceNode";
import { ParserBase } from "../../parserBase";
import { SpcDeclarationSentenceParser } from "./spcDeclarationSentenceParser";

export class SpcDeclarationParser extends ParserBase {

    override parse(): SpcDeclarationNode | undefined {
        this.skipTrivia();

        const keyword = this.acceptKeyword([
            "SPC",
            "SPECIFY"
        ]);

        if (!keyword) {
            return undefined;
        }

        const specifications: SpcDeclarationSentenceNode[] = [];
        const firstCheckpoint = this.problemCheckpoint();
        const first = new SpcDeclarationSentenceParser(
            this.context
        ).parse();

        if (!first) {
            if (!this.hasProblemsSince(firstCheckpoint)) {
                this.problems.error(
                    this.location(),
                    "Expected specification after SPC."
                );
            }

            this.synchronize([
                ";"
            ]);
        } else {
            specifications.push(first);

            while (this.acceptComma()) {
                const checkpoint = this.problemCheckpoint();
                const specification = new SpcDeclarationSentenceParser(
                    this.context
                ).parse();

                if (!specification) {
                    if (!this.hasProblemsSince(checkpoint)) {
                        this.problems.error(
                            this.location(),
                            "Expected specification after ','."
                        );
                    }

                    this.synchronize([
                        ";"
                    ]);

                    break;
                }

                specifications.push(specification);
            }
        }

        if (!this.expectSemicolon()) {
            specifications.length = 0;

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

        return new SpcDeclarationNode(
            this.tokenValue(keyword),
            specifications
        );
    }
}
