// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstNode } from "../../../ast/astNode";
import { ParserBase } from "../../parserBase";
import { BlockParser } from "./blockParser";
import { RepetitionParser } from "./repetitionParser";

/**
 * Common statement entry point. Only BEGIN and repetitions have AST nodes yet.
 * Other statements are skipped without consuming nested structural constructs.
 */
export class StatementParser extends ParserBase {

    override parse(): AstNode | undefined {
        this.skipTrivia();

        if (this.isKeyword("BEGIN")) {
            return new BlockParser(this.context).parse();
        }

        if (this.isKeyword(["FOR", "FROM", "BY", "TO", "WHILE", "REPEAT"])) {
            return new RepetitionParser(this.context).parse();
        }

        this.skipUnsupportedStatement();
        return undefined;
    }

    private skipUnsupportedStatement(): void {
        while (!this.eof()) {
            this.skipTrivia();

            if (this.eof() || this.isKeyword(["END", "MODEND"])) {
                return;
            }

            // Never skip a BEGIN or a repetition hidden in an unsupported IF/CASE.
            // FROM/BY/TO are deliberately omitted: they also occur inside other statements.
            if (this.isKeyword(["BEGIN", "FOR", "WHILE", "REPEAT"])) {
                return;
            }

            if (this.acceptOperator(";")) {
                return;
            }

            this.next();
        }
    }
}
