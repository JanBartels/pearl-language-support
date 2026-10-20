// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from "../../../core/sourceValue";
import { RepetitionNode } from "../../../ast/problem/statements/repetitionNode";
import { RepetitionForClauseNode } from "../../../ast/problem/statements/repetitionForClauseNode";
import { RepetitionExpressionClauseNode } from
    "../../../ast/problem/statements/repetitionExpressionClauseNode";
import { ParserBase } from "../../parserBase";
import { BodyParser } from "./bodyParser";

type ExpressionKeyword = "FROM" | "BY" | "TO" | "WHILE";

const CLAUSE_ORDER: Readonly<Record<string, number>> = {
    FOR: 0,
    FROM: 1,
    BY: 2,
    TO: 3,
    WHILE: 4
};

const HEADER_KEYWORDS = ["FOR", "FROM", "BY", "TO", "WHILE"] as const;

/**
 * Parses the complete repetition header structure. Expression tokens are stored
 * by clause until the general expression parser is introduced.
 */
export class RepetitionParser extends ParserBase {

    override parse(): RepetitionNode | undefined {
        this.skipTrivia();
        if (!this.isKeyword([...HEADER_KEYWORDS, "REPEAT"])) {
            return undefined;
        }

        const header: SourceValue<string>[] = [];
        let forClause: RepetitionForClauseNode | undefined;
        let fromClause: RepetitionExpressionClauseNode | undefined;
        let byClause: RepetitionExpressionClauseNode | undefined;
        let toClause: RepetitionExpressionClauseNode | undefined;
        let whileClause: RepetitionExpressionClauseNode | undefined;
        let lastOrder = -1;
        let repeatKeyword: SourceValue<string> | undefined;

        while (!this.eof()) {
            this.skipTrivia();

            const repeat = this.acceptKeyword("REPEAT");
            if (repeat) {
                repeatKeyword = this.tokenValue(repeat);
                break;
            }

            if (this.eof() || this.isHeaderBoundary()) {
                this.problems.error(this.location(), "Expected 'REPEAT' in repetition.");
                return undefined;
            }

            if (!this.isKeyword(HEADER_KEYWORDS)) {
                this.problems.error(this.location(),
                    `Unexpected '${this.tokenText()}' in repetition header.`);
                header.push(this.tokenValue(this.current()));
                this.next();
                continue;
            }

            const keywordToken = this.current();
            const keyword = this.tokenText(keywordToken) as keyof typeof CLAUSE_ORDER;
            const order = CLAUSE_ORDER[keyword]!;

            if (order <= lastOrder) {
                this.problems.error(this.location(),
                    `Repetition clause '${keyword}' is repeated or out of order.`);
            }
            lastOrder = Math.max(lastOrder, order);
            this.next();
            const keywordValue = this.tokenValue(keywordToken);
            header.push(keywordValue);

            if (keyword === "FOR") {
                this.skipTrivia();
                const variable = this.acceptIdentifier();
                if (!variable) {
                    this.problems.error(this.location(), "Expected control variable after 'FOR'.");
                } else {
                    header.push(this.tokenValue(variable));
                }

                if (!forClause) {
                    forClause = new RepetitionForClauseNode(
                        keywordValue,
                        variable ? this.tokenValue(variable) : undefined
                    );
                }
                continue;
            }

            const tokens = this.parseClauseExpression(keyword as ExpressionKeyword, header);
            const clause = new RepetitionExpressionClauseNode(keywordValue, tokens);

            switch (keyword) {
                case "FROM":
                    fromClause ??= clause;
                    break;
                case "BY":
                    byClause ??= clause;
                    break;
                case "TO":
                    toClause ??= clause;
                    break;
                case "WHILE":
                    whileClause ??= clause;
                    break;
            }
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
            forClause,
            fromClause,
            byClause,
            toClause,
            whileClause,
            repeatKeyword,
            body,
            end ? this.tokenValue(end) : undefined,
            identifier ? this.tokenValue(identifier) : undefined
        );
    }

    private parseClauseExpression(
        keyword: ExpressionKeyword,
        header: SourceValue<string>[]
    ): SourceValue<string>[] {
        const expression: SourceValue<string>[] = [];
        const delimiters: string[] = [];

        while (!this.eof()) {
            this.skipTrivia();
            if (this.eof()) {
                break;
            }

            // A missing closing parenthesis must not consume REPEAT or the body.
            if (this.isKeyword("REPEAT") || this.isHeaderBoundary()) {
                break;
            }

            if (delimiters.length === 0 && this.isKeyword(HEADER_KEYWORDS)) {
                break;
            }

            const token = this.current();
            const text = this.tokenText(token);

            if (this.isOperator(["(", "["])) {
                delimiters.push(text);
            } else if (this.isOperator([")", "]"])) {
                const opening = delimiters[delimiters.length - 1];
                if (!opening || (text === ")" && opening !== "(")
                    || (text === "]" && opening !== "[")) {
                    this.problems.error(this.location(),
                        `Unmatched '${text}' in '${keyword}' expression.`);
                    break;
                }
                delimiters.pop();
            }

            const value = this.tokenValue(token);
            expression.push(value);
            header.push(value);
            this.next();
        }

        if (delimiters.length > 0) {
            this.problems.error(this.location(),
                `Unclosed '${delimiters[delimiters.length - 1]}' in '${keyword}' expression.`);
        }
        if (expression.length === 0) {
            this.problems.error(this.location(), `Expected expression after '${keyword}'.`);
        }

        return expression;
    }

    /** Recovery boundaries not belonging to a repetition header. */
    private isHeaderBoundary(): boolean {
        return this.isKeyword([
            "END", "MODEND", "BEGIN", "FIN", "DCL", "DECLARE", "TYPE", "SPC", "SPECIFY"
        ]) || this.isOperator(";");
    }
}
