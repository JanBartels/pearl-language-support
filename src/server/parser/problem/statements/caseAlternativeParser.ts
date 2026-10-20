// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from "../../../core/sourceValue";
import { CaseAlternativeNode } from "../../../ast/problem/statements/caseAlternativeNode";
import { ParserBase } from "../../parserBase";
import { BodyParser } from "./bodyParser";

export class CaseAlternativeParser extends ParserBase {

    override parse(position = 1): CaseAlternativeNode | undefined {
        this.skipTrivia();
        const alt = this.acceptKeyword("ALT");
        if (!alt) {
            return undefined;
        }

        this.skipTrivia();
        const list = this.isOperator("(") ? this.parseCaseList() : undefined;
        const body = new BodyParser(this.context).parseStatements(["ALT", "OUT", "FIN"]);

        return new CaseAlternativeNode(this.tokenValue(alt), list, body, position);
    }

    /** Consume an indexed ALT list, retaining the original parentheses and values. */
    private parseCaseList(): SourceValue<string>[] {
        const list: SourceValue<string>[] = [];
        const brackets: string[] = [];
        let closed = false;

        while (!this.eof()) {
            this.skipTrivia();
            if (this.eof() || this.isKeyword(["ALT", "OUT", "FIN", "END", "MODEND"])) {
                break;
            }
            if (this.isOperator(";")) {
                break;
            }

            const token = this.current();
            const text = this.tokenText(token);
            if (this.isOperator(["(", "["])) {
                brackets.push(text);
            } else if (this.isOperator([")", "]"])) {
                const opening = brackets[brackets.length - 1];
                if (!opening || (opening === "(" && text !== ")")
                    || (opening === "[" && text !== "]")) {
                    this.problems.error(this.location(), "Mismatched bracket in ALT case list.");
                    break;
                }
                brackets.pop();
                if (brackets.length === 0) {
                    closed = true;
                }
            }

            list.push(this.tokenValue(token));
            this.next();
            if (closed) {
                break;
            }
        }

        if (!closed) {
            this.problems.error(this.location(), "Expected ')' after ALT case list.");
        } else if (list.length === 2) {
            this.problems.error(list[0].location ?? this.location(), "Expected a value in ALT case list.");
        }

        return list;
    }
}
