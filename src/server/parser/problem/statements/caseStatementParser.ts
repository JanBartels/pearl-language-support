// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { CaseStatementNode } from "../../../ast/problem/statements/caseStatementNode";
import { CaseAlternativeNode } from "../../../ast/problem/statements/caseAlternativeNode";
import { CaseOutNode } from "../../../ast/problem/statements/caseOutNode";
import { ParserBase } from "../../parserBase";
import { BodyParser } from "./bodyParser";
import { CaseAlternativeParser } from "./caseAlternativeParser";
import { StatementExpressionParser } from "../expressions/statementExpressionParser";

export class CaseStatementParser extends ParserBase {

    override parse(): CaseStatementNode | undefined {
        this.skipTrivia();
        const caseToken = this.acceptKeyword("CASE");
        if (!caseToken) {
            return undefined;
        }

        const selector = new StatementExpressionParser(this.context).parseUntil(
            ["ALT", "OUT", "FIN"], "CASE selector"
        );
        const expression = selector.expression;
        const alternatives: CaseAlternativeNode[] = [];
        let outClause: CaseOutNode | undefined;
        let indexed: boolean | undefined;

        while (!this.eof()) {
            this.skipTrivia();
            if (this.isKeyword(["FIN", "END", "MODEND"])) {
                break;
            }

            if (this.isKeyword("ALT")) {
                if (outClause) {
                    this.problems.error(this.location(), "ALT must precede OUT in CASE statement.");
                }
                const alternative = new CaseAlternativeParser(this.context).parse(alternatives.length + 1);
                if (alternative) {
                    const hasList = alternative.caseListTokens !== undefined;
                    if (indexed !== undefined && indexed !== hasList) {
                        this.problems.error(alternative.altKeyword.location ?? this.location(),
                            "CASE must not mix positional and indexed ALT forms.");
                    }
                    indexed ??= hasList;
                    alternatives.push(alternative);
                }
                continue;
            }

            if (this.isKeyword("OUT")) {
                const outToken = this.acceptKeyword("OUT")!;
                if (outClause) {
                    this.problems.error(this.location(outToken), "OUT is repeated in CASE statement.");
                }
                const body = new BodyParser(this.context).parseStatements(["ALT", "OUT", "FIN"]);
                if (!outClause) {
                    outClause = new CaseOutNode(this.tokenValue(outToken), body);
                }
                continue;
            }

            // Recover unsupported statements before an ALT instead of swallowing FIN/END.
            this.problems.error(this.location(), "Expected ALT, OUT or FIN in CASE statement.");
            new BodyParser(this.context).parseStatements(["ALT", "OUT", "FIN"]);
        }

        if (alternatives.length === 0) {
            this.problems.error(this.location(), "Expected at least one ALT in CASE statement.");
        }

        this.skipTrivia();
        const finToken = this.acceptKeyword("FIN");
        if (!finToken) {
            this.problems.error(this.location(), "Expected 'FIN' after CASE statement.");
        } else {
            this.expectSemicolon("Expected ';' after CASE FIN.");
        }

        return new CaseStatementNode(
            this.tokenValue(caseToken),
            selector.values,
            alternatives,
            outClause,
            finToken ? this.tokenValue(finToken) : undefined,
            expression
        );
    }
}
