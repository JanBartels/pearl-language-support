// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from "../../../core/sourceValue";
import { RepetitionNode } from "../../../ast/problem/statements/repetitionNode";
import { ParserBase } from "../../parserBase";
import { BodyParser } from "./bodyParser";

/**
 * Structural parser only: preserve the header tokens, without interpreting
 * expressions or creating the implicit FIXED loop-variable symbol yet.
 */
export class RepetitionParser extends ParserBase {

    override parse(): RepetitionNode | undefined {
        this.skipTrivia();

        if (!this.isKeyword(["FOR", "FROM", "BY", "TO", "WHILE", "REPEAT"])) {
            return undefined;
        }

        const header: SourceValue<string>[] = [];
        let repeatKeyword: SourceValue<string> | undefined;

        while (!this.eof()) {
            this.skipTrivia();
            if (this.eof()) {
                break;
            }

            const repeat = this.acceptKeyword("REPEAT");
            if (repeat) {
                repeatKeyword = this.tokenValue(repeat);
                break;
            }

            // Incomplete headers must not swallow the enclosing END or a new block.
            if (this.isKeyword(["END", "MODEND", "BEGIN", "FIN"])
                || this.isOperator(";")) {
                this.problems.error(this.location(), "Expected 'REPEAT' in repetition.");
                return undefined;
            }

            header.push(this.tokenValue(this.current()));
            this.next();
        }

        if (!repeatKeyword) {
            this.problems.error(this.location(), "Expected 'REPEAT' in repetition.");
            return undefined;
        }

        const body = new BodyParser(this.context).parseBody();
        this.skipTrivia();
        const end = this.acceptKeyword("END");

        if (!end) {
            this.problems.error(this.location(), "Expected 'END' after REPEAT body.");
        }

        this.skipTrivia();
        const identifier = end ? this.acceptIdentifier() : undefined;

        if (end) {
            this.expectSemicolon("Expected ';' after repetition END.");
        }

        return new RepetitionNode(
            header,
            repeatKeyword,
            body,
            end ? this.tokenValue(end) : undefined,
            identifier ? this.tokenValue(identifier) : undefined
        );
    }
}
