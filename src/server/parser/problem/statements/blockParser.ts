// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { BlockNode } from "../../../ast/problem/statements/blockNode";
import { ParserBase } from "../../parserBase";
import { BodyParser } from "./bodyParser";

export class BlockParser extends ParserBase {

    override parse(): BlockNode | undefined {
        this.skipTrivia();
        const begin = this.acceptKeyword("BEGIN");
        if (!begin) {
            return undefined;
        }

        const body = new BodyParser(this.context).parseBody();
        this.skipTrivia();

        const end = this.acceptKeyword("END");
        if (!end) {
            this.problems.error(this.location(), "Expected 'END' after BEGIN body.");
        }

        // END identifiers name blocks for later EXIT statements.
        this.skipTrivia();
        const identifier = end ? this.acceptIdentifier() : undefined;

        if (end) {
            this.expectSemicolon("Expected ';' after block END.");
        }

        return new BlockNode(
            this.tokenValue(begin),
            body,
            end ? this.tokenValue(end) : undefined,
            identifier ? this.tokenValue(identifier) : undefined
        );
    }
}
