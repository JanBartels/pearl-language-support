// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Location } from '../../../core/location';
import { SourceValue } from '../../../core/sourceValue';
import { CallStatementNode } from '../../../ast/problem/statements/callStatementNode';
import type { Token } from '../../../lexer/token';
import { ParserBase } from '../../parserBase';

type ArgumentProblem = { location: Location; message: string };

type ParsedArguments = {
    argumentsList: SourceValue<string>[][];
    problems: ArgumentProblem[];
};

/** Parses both CALL Name(...) and Name(...) with the same call AST. */
export class CallStatementParser extends ParserBase {
    override parse(): CallStatementNode | undefined {
        this.skipTrivia();
        const keyword = this.acceptKeyword('CALL');
        if (!keyword) return undefined;

        this.skipTrivia();
        const identifier = this.expectIdentifier('Expected procedure identifier after CALL.');
        return this.parseCallTail(identifier, keyword);
    }

    /** Called after an identifier was consumed by the statement dispatcher. */
    parseAfterIdentifier(identifier: Token): CallStatementNode | undefined {
        return this.parseCallTail(identifier);
    }

    private parseCallTail(identifier: Token | undefined, keyword?: Token): CallStatementNode | undefined {
        this.skipTrivia();
        const hasParenthesis = this.acceptLeftParenthesis();
        const parsed = hasParenthesis ? this.readArguments() : undefined;
        this.skipTrivia();

        // In the keywordless form the final delimiter decides the grammar.
        // In particular, Feld(1) = x and Feld(1).CHAR(2) = x are not calls.
        // A known statement boundary after ')' permits local missing-';'
        // recovery without consuming the next statement.
        if (!keyword && !this.isOperator(';')
            && !(hasParenthesis && this.isCallRecoveryBoundary())) {
            return undefined;
        }

        for (const problem of parsed?.problems ?? []) {
            this.problems.error(problem.location, problem.message);
        }

        if (!this.expectSemicolon(keyword
            ? "Expected ';' after CALL."
            : "Expected ';' after procedure call.")) {
            this.synchronize([';', 'END', 'MODEND', 'FIN', 'ELSE', 'ALT', 'OUT',
                'BEGIN', 'FOR', 'WHILE', 'REPEAT', 'IF', 'CASE', 'CALL', 'RETURN']);
            this.acceptSemicolon();
        }

        return new CallStatementNode(
            keyword ? this.tokenValue(keyword) : undefined,
            identifier ? this.tokenValue(identifier) : undefined,
            parsed?.argumentsList
        );
    }

    private isCallRecoveryBoundary(): boolean {
        return this.eof() || this.isKeyword([
            'END', 'MODEND', 'FIN', 'ELSE', 'ALT', 'OUT', 'BEGIN',
            'FOR', 'WHILE', 'REPEAT', 'IF', 'CASE', 'CALL', 'RETURN', 'GOTO'
        ]);
    }

    /**
     * Keeps the actual arguments as source tokens until expression ASTs exist.
     * Delay diagnostics: an identifier followed by '(...)' might still be an
     * array element on the left hand side of an assignment.
     */
    private readArguments(): ParsedArguments {
        const args: SourceValue<string>[][] = [];
        const problems: ArgumentProblem[] = [];
        const brackets: string[] = [];
        let current: SourceValue<string>[] = [];
        let closed = false;

        while (!this.eof()) {
            this.skipTrivia();
            if (this.eof() || this.isOperator(';') || this.isKeyword([
                'END', 'MODEND', 'FIN', 'ELSE', 'ALT', 'OUT'
            ])) break;

            if (this.isOperator(')') && brackets.length === 0) {
                this.next();
                closed = true;
                break;
            }

            if (this.isOperator(',') && brackets.length === 0) {
                if (!current.length) {
                    problems.push({ location: this.location(), message: 'Expected CALL argument.' });
                }
                args.push(current);
                current = [];
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
            this.next();
        }

        if (current.length) args.push(current);
        else if (args.length) {
            problems.push({ location: this.location(),
                message: 'Expected CALL argument after comma.' });
        }
        if (!closed) {
            problems.push({ location: this.location(),
                message: "Expected ')' after CALL arguments." });
        }

        return { argumentsList: args, problems };
    }
}
