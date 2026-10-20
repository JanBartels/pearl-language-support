// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { IfStatementNode } from "../../../ast/problem/statements/ifStatementNode";
import { ParserBase } from "../../parserBase";
import { BodyParser } from "./bodyParser";
import { StatementHeaderParser } from "./statementHeaderParser";

export class IfStatementParser extends ParserBase {

    override parse(): IfStatementNode | undefined {
        this.skipTrivia();
        const ifToken = this.acceptKeyword("IF");
        if (!ifToken) {
            return undefined;
        }

        const condition = new StatementHeaderParser(this.context).readUntil(
            ["THEN"], "IF condition"
        );
        this.skipTrivia();
        const thenToken = this.acceptKeyword("THEN");
        if (!thenToken) {
            this.problems.error(this.location(), "Expected 'THEN' after IF condition.");
        }

        const thenBody = new BodyParser(this.context).parseStatements(["ELSE", "FIN"]);
        this.skipTrivia();
        const elseToken = this.acceptKeyword("ELSE");
        const elseBody = elseToken
            ? new BodyParser(this.context).parseStatements(["FIN"])
            : [];

        this.skipTrivia();
        const finToken = this.acceptKeyword("FIN");
        if (!finToken) {
            this.problems.error(this.location(), "Expected 'FIN' after IF statement.");
        } else {
            this.expectSemicolon("Expected ';' after IF FIN.");
        }

        return new IfStatementNode(
            this.tokenValue(ifToken),
            condition,
            thenToken ? this.tokenValue(thenToken) : undefined,
            thenBody,
            elseToken ? this.tokenValue(elseToken) : undefined,
            elseBody,
            finToken ? this.tokenValue(finToken) : undefined
        );
    }
}
