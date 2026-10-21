// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../../core/sourceValue';
import { CallStatementNode } from '../../../ast/problem/statements/callStatementNode';
import { ParserBase } from '../../parserBase';

/** Explicit CALL; no expression parsing or speculative recognition of bare calls. */
export class CallStatementParser extends ParserBase {
    override parse(): CallStatementNode | undefined {
        this.skipTrivia();
        const keyword = this.acceptKeyword('CALL');
        if (!keyword) return undefined;
        this.skipTrivia();
        const identifier = this.expectIdentifier('Expected procedure identifier after CALL.');
        const target = identifier ? this.tokenValue(identifier) : undefined;
        this.skipTrivia();
        const args = this.acceptLeftParenthesis() ? this.readArguments() : undefined;
        if (!this.expectSemicolon("Expected ';' after CALL.")) {
            this.synchronize([';', 'END', 'MODEND', 'FIN', 'ELSE', 'ALT', 'OUT',
                'BEGIN', 'FOR', 'WHILE', 'REPEAT', 'IF', 'CASE', 'CALL', 'RETURN']);
            this.acceptSemicolon();
        }
        return new CallStatementNode(this.tokenValue(keyword), target, args);
    }

    private readArguments(): SourceValue<string>[][] {
        const args: SourceValue<string>[][] = [];
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
                if (!current.length) this.problems.error(this.location(), 'Expected CALL argument.');
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
                    this.problems.error(this.location(), `Unexpected '${text}' in CALL arguments.`);
                    break;
                }
                brackets.pop();
            }
            current.push(this.tokenValue(token));
            this.next();
        }
        if (current.length) args.push(current);
        else if (args.length) this.problems.error(this.location(), 'Expected CALL argument after comma.');
        if (!closed) this.problems.error(this.location(), "Expected ')' after CALL arguments.");
        return args;
    }
}
