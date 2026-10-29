// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { CallStatementNode } from '../../../ast/problem/statements/callStatementNode';
import { TokenKind, type Token } from '../../../lexer/token';
import { ParserBase } from '../../parserBase';
import { ActualParameterListParser } from './actualParameterListParser';

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

    parseAfterIdentifier(identifier: Token): CallStatementNode | undefined {
        return this.parseCallTail(identifier);
    }

    private parseCallTail(identifier: Token | undefined, keyword?: Token): CallStatementNode | undefined {
        this.skipTrivia();
        // Before committing an implicit call, inspect the *live* token stream
        // without advancing it. A(1) = X must remain an unsupported assignment,
        // and no speculative expression diagnostics may leak from it.
        if (!keyword && !this.looksLikeImplicitCall()) return undefined;

        const opening = this.acceptOperator('(');
        const actualParameters = opening
            ? new ActualParameterListParser(this.context).parseAfterOpenParenthesis(opening)
            : undefined;
        this.skipTrivia();
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
            actualParameters
        );
    }

    private looksLikeImplicitCall(): boolean {
        let offset = 0;
        const next = (): Token => this.context.stream.peek(offset++);
        const peek = (): Token => this.context.stream.peek(offset);
        const text = (token: Token): string => this.context.stream.tokenText(token);
        const trivia = (token: Token): boolean => token.kind === TokenKind.Comment
            || token.kind === TokenKind.Newline;
        while (trivia(peek())) next();
        const first = peek();
        if (text(first) === ';' || this.isCallRecoveryBoundary(first)) return true;
        if (text(first) !== '(') return false;
        next();
        const brackets: string[] = ['('];
        while (true) {
            const token = peek();
            if (token.kind === TokenKind.EOF) return true;
            if (trivia(token)) { next(); continue; }
            const value = text(token);
            if (this.isCallRecoveryBoundary(token) || value === ';') return true;
            if (value === '=' || value === ':=') return false;
            if (value === '(' || value === '[') brackets.push(value);
            if (value === ')' || value === ']') {
                if (brackets[brackets.length - 1] !== (value === ')' ? '(' : '[')) {
                    return false;
                }
                brackets.pop();
                if (!brackets.length) {
                    next();
                    while (trivia(peek())) next();
                    const tail = peek();
                    return text(tail) === ';' || this.isCallRecoveryBoundary(tail);
                }
            }
            next();
        }
    }

    private isCallRecoveryBoundary(token: Token): boolean {
        return token.kind === TokenKind.EOF ||
            (token.kind === TokenKind.Identifier && [
                'END', 'MODEND', 'FIN', 'ELSE', 'ALT', 'OUT', 'BEGIN',
                'FOR', 'WHILE', 'REPEAT', 'IF', 'CASE', 'CALL', 'RETURN', 'GOTO'
            ].includes(this.tokenText(token)));
    }
}
