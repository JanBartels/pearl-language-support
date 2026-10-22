// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstNode } from "../../../ast/astNode";
import { ParserBase } from "../../parserBase";
import { BlockParser } from "./blockParser";
import { RepetitionParser } from "./repetitionParser";
import { IfStatementParser } from "./ifStatementParser";
import { CaseStatementParser } from "./caseStatementParser";
import { CallStatementParser } from "./callStatementParser";
import { ReturnStatementParser } from "./returnStatementParser";
import { GotoStatementParser } from "./gotoStatementParser";
import { LabeledStatementParser } from "./labeledStatementParser";
import { EmptyStatementNode } from "../../../ast/problem/statements/emptyStatementNode";

/** All nested statement constructs are dispatched through this common entry point. */
export class StatementParser extends ParserBase {

    override parse(): AstNode | undefined {
        this.skipTrivia();

        if (this.isKeyword("BEGIN")) {
            return new BlockParser(this.context).parse();
        }

        if (this.isKeyword(["FOR", "FROM", "BY", "TO", "WHILE", "REPEAT"])) {
            return new RepetitionParser(this.context).parse();
        }

        if (this.isKeyword("IF")) {
            return new IfStatementParser(this.context).parse();
        }

        if (this.isKeyword("CASE")) {
            return new CaseStatementParser(this.context).parse();
        }

        if (this.isKeyword("CALL")) {
            return new CallStatementParser(this.context).parse();
        }

        if (this.isKeyword("RETURN")) {
            return new ReturnStatementParser(this.context).parse();
        }

        if (this.isKeyword("GOTO")) {
            return new GotoStatementParser(this.context).parse();
        }

        // Identifier is a shared prefix of labels and identifier-led
        // statements. Only ':' introduces a label. Other tails (currently
        // unsupported assignments, etc.) keep the previous recovery behavior.
        if (this.isIdentifier()) {
            const identifier = this.acceptIdentifier()!;
            this.skipTrivia();
            if (this.isOperator(":")) {
                return new LabeledStatementParser(this.context)
                    .parseAfterIdentifier(identifier);
            }
            this.skipUnsupportedStatement();
            return undefined;
        }

        const empty = this.acceptOperator(";");
        if (empty) {
            return new EmptyStatementNode(this.tokenValue(empty));
        }

        // An unmatched conditional delimiter must not trap the parser in a loop.
        if (this.isKeyword(["THEN", "ELSE", "ALT", "OUT", "FIN"])) {
            this.problems.error(this.location(),
                `Unexpected '${this.tokenText()}' outside its conditional statement.`);
            this.next();
            return undefined;
        }

        this.skipUnsupportedStatement();
        return undefined;
    }

    private skipUnsupportedStatement(): void {
        while (!this.eof()) {
            this.skipTrivia();

            if (this.eof() || this.isKeyword([
                "END", "MODEND", "THEN", "ELSE", "ALT", "OUT", "FIN"
            ])) {
                return;
            }

            // Leave any nested structured statement to the shared statement parser.
            if (this.isKeyword(["BEGIN", "FOR", "WHILE", "REPEAT", "IF", "CASE"])) {
                return;
            }

            if (this.acceptOperator(";")) {
                return;
            }

            this.next();
        }
    }
}
