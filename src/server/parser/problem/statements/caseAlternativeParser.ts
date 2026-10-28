// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from "../../../core/sourceValue";
import type { Token } from "../../../lexer/token";
import { CaseIndexRangeNode } from "../../../ast/problem/statements/caseIndexRangeNode";
import { parseBufferedExpression } from "../expressions/parseBufferedExpression";
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

        return new CaseAlternativeNode(this.tokenValue(alt), list?.values, body, position, list?.ranges);
    }

    /** Consume an indexed ALT list, retaining the original parentheses and values. */
    private parseCaseList(): {
        values: SourceValue<string>[];
        ranges: CaseIndexRangeNode[];
    } {
        const list: SourceValue<string>[] = [];
        const original: Token[] = [];
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
            original.push(token);
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

        return { values: list, ranges: closed ? this.parseRanges(original) : [] };
    }
    /** Parentheses delimit the list; top-level comma/colon delimit IndexRange.
     * Preserve each original token for the shared expression parser and source map.
     */
    private parseRanges(tokens: readonly Token[]): CaseIndexRangeNode[] {
        const ranges: CaseIndexRangeNode[] = [];
        const contents = tokens.slice(1, -1);
        let depth = 0;
        let part: Token[] = [];
        const emit = (): void => {
            const separators = part.reduce<number[]>((indexes, token, index) => {
                if (this.textOf(token) === ':' && this.depthAt(part, index) === 0) indexes.push(index);
                return indexes;
            }, []);
            if (separators.length > 1 || part.length === 0) {
                const source = part[0]?.location ?? tokens[0]?.location;
                if (source) this.problems.error(source, 'Expected IndexRange in ALT list.');
                part = [];
                return;
            }
            const colonIndex = separators[0];
            const low = colonIndex === undefined ? part : part.slice(0, colonIndex);
            const high = colonIndex === undefined ? [] : part.slice(colonIndex + 1);
            if (!low.length || (colonIndex !== undefined && !high.length)) {
                this.problems.error(part[colonIndex ?? 0].location, 'Expected constant in ALT range.');
            }
            ranges.push(new CaseIndexRangeNode(
                parseBufferedExpression(low, this.context),
                colonIndex === undefined ? undefined : this.tokenValue(part[colonIndex]),
                parseBufferedExpression(high, this.context)
            ));
            part = [];
        };
        for (const token of contents) {
            const value = this.textOf(token);
            if (value === ',' && depth === 0) { emit(); continue; }
            if (value === '(' || value === '[') depth++;
            if (value === ')' || value === ']') depth--;
            part.push(token);
        }
        emit();
        return ranges;
    }

    private textOf(token: Token): string {
        return token.location.source.getText(token.location.span);
    }

    private depthAt(tokens: readonly Token[], index: number): number {
        let depth = 0;
        for (let i = 0; i < index; i++) {
            const text = this.textOf(tokens[i]);
            if (text === '(' || text === '[') depth++;
            if (text === ')' || text === ']') depth--;
        }
        return depth;
    }
}
