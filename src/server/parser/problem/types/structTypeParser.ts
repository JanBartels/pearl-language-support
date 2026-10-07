// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ParserBase } from "../../parserBase";

import { StructTypeNode } from "../../../ast/problem/types/structTypeNode";
import { StructComponentNode } from "../../../ast/problem/types/structComponentNode";

import { StructComponentParser } from "./structComponentParser";

export class StructTypeParser extends ParserBase {

    override parse(): StructTypeNode | undefined {

        this.skipTrivia();

        const keyword =
            this.acceptKeyword("STRUCT");

        if (!keyword) {
            return undefined;
        }

        if (!this.expectLeftBracket()) {

            this.synchronize([
                "]",
                ",",
                ";"
            ]);

            return new StructTypeNode(
                this.tokenValue(keyword),
                []
            );
        }

        const components:
            StructComponentNode[] = [];

        if (this.acceptRightBracket()) {

            return new StructTypeNode(
                this.tokenValue(keyword),
                components
            );
        }

        while (!this.eof()) {

            const component =
                new StructComponentParser(
                    this.context
                ).parse();

            if (component) {
                components.push(component);
            } else {

                this.synchronize([
                    ",",
                    "]"
                ]);
            }

            if (this.acceptRightBracket()) {
                break;
            }

            if (this.acceptComma()) {
                continue;
            }

            this.problems.error(
                this.location(),
                "Expected ',' or ']' after structure component."
            );

            this.synchronize([
                ",",
                "]"
            ]);

            if (this.acceptRightBracket()) {
                break;
            }

            if (this.acceptComma()) {
                continue;
            }

            break;
        }

        return new StructTypeNode(
            this.tokenValue(keyword),
            components
        );
    }
}
