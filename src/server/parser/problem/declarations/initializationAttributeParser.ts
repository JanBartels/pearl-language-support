// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ParserBase } from "../../parserBase";

import { InitializationAttributeNode } from "../../../ast/problem/declarations/initializationAttributeNode";
import { InitElementNode } from "../../../ast/problem/declarations/initElementNode";

import { InitElementParser } from "./initElementParser";

export class InitializationAttributeParser extends ParserBase {

    override parse(): InitializationAttributeNode | undefined {

        this.skipTrivia();

        const keyword =
            this.acceptKeyword([
                "INITIAL",
                "INIT"
            ]);

        if (!keyword) {
            return undefined;
        }

        const elements: InitElementNode[] = [];

        if (!this.expectLeftParenthesis(
            "Expected '(' after initialization attribute."
        )) {
            return new InitializationAttributeNode(
                this.tokenValue(keyword),
                elements
            );
        }

        const first =
            new InitElementParser(
                this.context
            ).parse();

        if (!first) {

            this.problems.error(
                this.location(),
                "Expected initialization element."
            );

            this.synchronize([
                ")",
                ";",
                "TYPE",
                "DCL",
                "DECLARE",
                "MODEND"
            ]);

            this.acceptRightParenthesis();

            return new InitializationAttributeNode(
                this.tokenValue(keyword),
                elements
            );
        }

        elements.push(first);

        while (this.acceptComma()) {

            const element =
                new InitElementParser(
                    this.context
                ).parse();

            if (!element) {

                this.problems.error(
                    this.location(),
                    "Expected initialization element after ','."
                );

                this.synchronize([
                    ")",
                    ";",
                    "TYPE",
                    "DCL",
                    "DECLARE",
                    "MODEND"
                ]);

                break;
            }

            elements.push(element);
        }

        this.expectRightParenthesis(
            "Expected ')' after initialization list."
        );

        return new InitializationAttributeNode(
            this.tokenValue(keyword),
            elements
        );
    }
}
