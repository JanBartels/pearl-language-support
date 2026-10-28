// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from "../../../core/sourceValue";
import { ParserBase } from "../../parserBase";
import type { Token } from "../../../lexer/token";

/**
 * Reads an as-yet-unparsed expression up to its grammatical delimiter.
 * This is deliberately NOT an expression parser: it only preserves tokens
 * and protects nested parentheses/brackets while locating the delimiter.
 */
export class StatementHeaderParser extends ParserBase {

    override parse(): undefined {
        throw new Error("Use StatementHeaderParser.readUntil().");
    }

    readUntil(terminators: readonly string[], description: string): SourceValue<string>[] {
        return this.readUntilWithTokens(terminators, description).values;
    }

    /** Also return original preprocessed tokens for the shared expression parser. */
    readUntilWithTokens(terminators: readonly string[], description: string): {
        readonly values: SourceValue<string>[];
        readonly tokens: Token[];
    } {
        const tokens: SourceValue<string>[] = [];
        const originalTokens: Token[] = [];
        const brackets: string[] = [];
        const boundaries = [
            "END", "MODEND", "BEGIN", "REPEAT", "FIN", "ELSE", "ALT", "OUT",
            "DCL", "DECLARE", "TYPE", "SPC", "SPECIFY"
        ];

        while (!this.eof()) {
            this.skipTrivia();
            if (this.eof() || this.isOperator(";")) {
                break;
            }

            if (this.isKeyword(boundaries)) {
                break;
            }

            if (this.isKeyword(terminators)) {
                break;
            }

            const token = this.current();
            const value = this.tokenText(token);

            if (this.isOperator(["(", "["])) {
                brackets.push(value);
            } else if (this.isOperator([")", "]"])) {
                const opening = brackets[brackets.length - 1];
                if (!opening || (value === ")" && opening !== "(")
                    || (value === "]" && opening !== "[")) {
                    this.problems.error(this.location(), `Unmatched '${value}' in ${description}.`);
                    break;
                }
                brackets.pop();
            }

            tokens.push(this.tokenValue(token));
            originalTokens.push(token);
            this.next();
        }

        if (brackets.length > 0) {
            this.problems.error(this.location(),
                `Unclosed '${brackets[brackets.length - 1]}' in ${description}.`);
        }

        if (tokens.length === 0) {
            this.problems.error(this.location(), `Expected expression in ${description}.`);
        }

        return { values: tokens, tokens: originalTokens };
    }
}
