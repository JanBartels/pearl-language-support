// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Location } from '../../../core/location';
import { SourceValue } from '../../../core/sourceValue';
import { ActualParameterNode } from '../../../ast/problem/statements/actualParameterNode';
import { ActualParameterListNode } from '../../../ast/problem/statements/actualParameterListNode';
import type { Token } from '../../../lexer/token';
import { ParserBase } from '../../parserBase';

export interface ActualParameterListProblem {
    readonly location: Location;
    readonly message: string;
}

export interface ParsedActualParameterList {
    readonly node: ActualParameterListNode;
    readonly problems: readonly ActualParameterListProblem[];
    /** Original tokens for each slot; only the committed CALL parses them. */
    readonly parameterTokens: readonly (readonly Token[])[];
}

/** Parses the suffix beginning immediately after the consumed '('.
 *
 * The caller decides whether these tokens belong to a CALL or to an
 * unsupported identifier-led construction (e.g. array assignment). Therefore
 * diagnostics are returned and only committed by the caller after that choice.
 * No symbol lookup or expression parsing is performed here; the CALL parser
 * attaches expression nodes only after committing to the CALL grammar.
 */
export class ActualParameterListParser extends ParserBase {
    override parse(): ActualParameterListNode | undefined {
        throw new Error('Use ActualParameterListParser.parseAfterOpenParenthesis().');
    }

    parseAfterOpenParenthesis(openParenthesis: Token): ParsedActualParameterList {
        const parameters: ActualParameterNode[] = [];
        const commas: SourceValue<string>[] = [];
        const problems: ActualParameterListProblem[] = [];
        const brackets: string[] = [];
        let current: SourceValue<string>[] = [];
        let currentTokens: Token[] = [];
        const parameterTokens: Token[][] = [];
        const appendParameter = (): void => {
            parameters.push(new ActualParameterNode(current));
            parameterTokens.push(currentTokens);
        };
        let closeParenthesis: SourceValue<string> | undefined;

        while (!this.eof()) {
            this.skipTrivia();
            if (this.eof() || this.isOperator(';') || this.isStatementBoundary()) break;

            if (this.isOperator(')') && brackets.length === 0) {
                closeParenthesis = this.tokenValue(this.current());
                this.next();
                break;
            }

            if (this.isOperator(',') && brackets.length === 0) {
                if (!current.length) {
                    problems.push({ location: this.location(), message: 'Expected CALL argument.' });
                }
                appendParameter();
                current = [];
                currentTokens = [];
                commas.push(this.tokenValue(this.current()));
                this.next();
                continue;
            }

            const token = this.current();
            const text = this.tokenText(token);
            if (this.isOperator(['(', '['])) brackets.push(text);
            else if (this.isOperator([')', ']'])) {
                const expected = text === ')' ? '(' : '[';
                if (brackets[brackets.length - 1] !== expected) {
                    problems.push({ location: this.location(),
                        message: `Unexpected '${text}' in CALL arguments.` });
                    break;
                }
                brackets.pop();
            }
            current.push(this.tokenValue(token));
            currentTokens.push(token);
            this.next();
        }

        // Retain the last slot even if it is empty after a comma or an opening
        // parenthesis. P() is the only form without any slots.
        if (current.length || commas.length || !closeParenthesis) {
            appendParameter();
        }
        if (!current.length && commas.length) {
            problems.push({ location: this.location(), message: 'Expected CALL argument after comma.' });
        }
        if (!closeParenthesis) {
            problems.push({ location: this.location(), message: "Expected ')' after CALL arguments." });
        }

        return {
            node: new ActualParameterListNode(
                this.tokenValue(openParenthesis), parameters, commas, closeParenthesis,
                closeParenthesis ? undefined : this.tokenValue(this.current())
            ),
            problems,
            parameterTokens
        };
    }

    private isStatementBoundary(): boolean {
        return this.isKeyword([
            'END', 'MODEND', 'FIN', 'ELSE', 'ALT', 'OUT', 'BEGIN',
            'FOR', 'WHILE', 'REPEAT', 'IF', 'CASE', 'CALL', 'RETURN', 'GOTO'
        ]);
    }
}
