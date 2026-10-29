// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AssignmentNode } from '../../../ast/problem/statements/assignmentNode';
import { Token, TokenKind } from '../../../lexer/token';
import { ParserBase } from '../../parserBase';
import { NameExpressionParser } from '../expressions/nameExpressionParser';
import { StatementExpressionParser } from '../expressions/statementExpressionParser';

/**
 * Name (':=' | '=') Expression ';'.
 *
 * Lookahead recognizes the assignment suffix before committing to Name.
 * The same prefix may also be an implicit CALL; no speculative expression
 * parse and no symbol lookup are used to distinguish these productions.
 */
export class AssignmentParser extends ParserBase {
    override parse(): AssignmentNode | undefined {
        this.skipTrivia();
        const identifier = this.acceptIdentifier();
        return identifier ? this.parseAfterIdentifier(identifier) : undefined;
    }

    parseAfterIdentifier(identifier: Token): AssignmentNode | undefined {
        if (!this.looksLikeAssignment()) return undefined;
        return this.parseAssignment(identifier);
    }

    /** CONT Name = Expression; has a distinct destination grammar. */
    parseContAssignment(): AssignmentNode | undefined {
        this.skipTrivia();
        const cont = this.acceptKeyword('CONT');
        if (!cont) return undefined;
        this.skipTrivia();
        const identifier = this.acceptIdentifier();
        if (!identifier) {
            this.problems.error(this.location(), "Expected assignment target after CONT.");
            this.synchronize([';', 'END', 'MODEND', 'FIN', 'ELSE', 'ALT', 'OUT']);
            this.acceptSemicolon();
            return undefined;
        }
        return this.parseAssignment(identifier, cont);
    }

    private parseAssignment(identifier: Token, cont?: Token): AssignmentNode | undefined {
        const target = new NameExpressionParser(this.context).parseAfterIdentifier(identifier);
        this.skipTrivia();
        const operator = this.expectOperator([':=', '='], 'Expected assignment operator after name.');
        if (!operator) {
            this.synchronize([';', 'END', 'MODEND', 'FIN', 'ELSE', 'ALT', 'OUT']);
            this.acceptSemicolon();
            return undefined;
        }

        const rhs = new StatementExpressionParser(this.context)
            .parseUntil([';'], 'assignment');
        this.skipTrivia();
        const semicolon = this.acceptOperator(';');
        if (!semicolon) {
            this.problems.error(this.location(), "Expected ';' after assignment.");
            this.synchronize([';', 'END', 'MODEND', 'FIN', 'ELSE', 'ALT', 'OUT']);
            this.acceptSemicolon();
        }

        return new AssignmentNode(target, this.tokenValue(operator), rhs.expression,
            semicolon ? this.tokenValue(semicolon) : undefined,
            cont ? this.tokenValue(cont) : undefined);
    }

    /**
     * Inspect only the Name suffix, not the semantic meaning of its brackets.
     * Parentheses can denote either indices or calls; a top-level '=' / ':='
     * after the whole Name is what commits this statement to Assignment.
     */
    private looksLikeAssignment(): boolean {
        let offset = 0;
        const peek = (): Token => this.context.stream.peek(offset);
        const text = (token: Token): string => this.context.stream.tokenText(token);
        const skipTrivia = (): void => {
            while (peek().kind === TokenKind.Newline || peek().kind === TokenKind.Comment) offset++;
        };
        skipTrivia();

        while (true) {
            if (text(peek()) === '(') {
                const brackets: string[] = ['('];
                offset++;
                while (brackets.length) {
                    const token = peek();
                    if (token.kind === TokenKind.EOF || text(token) === ';') return false;
                    const value = text(token);
                    if (value === '(' || value === '[') brackets.push(value);
                    if (value === ')' || value === ']') {
                        if (brackets.pop() !== (value === ')' ? '(' : '[')) return false;
                    }
                    offset++;
                }
                skipTrivia();
            }
            if (text(peek()) !== '.') break;
            offset++;
            skipTrivia();
            // Standard selectors such as .BIT and .CHAR are Identifier tokens.
            if (peek().kind !== TokenKind.Identifier) return false;
            offset++;
            skipTrivia();
        }

        return peek().kind === TokenKind.Operator
            && (text(peek()) === ':=' || text(peek()) === '=');
    }
}
