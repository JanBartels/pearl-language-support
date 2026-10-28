// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ReturnStatementNode } from '../../../ast/problem/statements/returnStatementNode';
import { ExpressionNode } from '../../../ast/problem/expressions/expressionNode';
import type { Token } from '../../../lexer/token';
import { ParserBase } from '../../parserBase';
import { ExpressionParser } from '../expressions/expressionParser';

/** RETURN [ '(' Expression ')' ] ';'. */
export class ReturnStatementParser extends ParserBase {
    override parse(): ReturnStatementNode | undefined {
        this.skipTrivia();
        const keyword = this.acceptKeyword('RETURN');
        if (!keyword) return undefined;
        this.skipTrivia();

        // Preserve previous recovery for an unparenthesized RETURN value.
        if (!this.isOperator(['(', ';']) && !this.isKeyword([
            'END', 'MODEND', 'FIN', 'ELSE', 'ALT', 'OUT'
        ])) {
            this.problems.error(this.location(),
                "Expected '(' before RETURN expression. Use RETURN(<expression>);");
            this.synchronize([';', 'END', 'MODEND', 'FIN', 'ELSE', 'ALT', 'OUT']);
            this.acceptSemicolon();
            return new ReturnStatementNode(this.tokenValue(keyword));
        }

        const opening = this.acceptOperator('(');
        let expression: ExpressionNode | undefined;
        let closing: Token | undefined;
        if (opening) {
            expression = new ExpressionParser(this.context).parse();
            if (!expression) {
                this.problems.error(this.location(), 'Expected expression in RETURN.');
            }
            this.skipTrivia();
            closing = this.acceptOperator(')');
            if (!closing) {
                this.problems.error(this.location(), "Expected ')' after RETURN expression.");
                // Keep the enclosing statement/block intact, even when an
                // expression contains currently unsupported syntax.
                this.synchronize([';', 'END', 'MODEND', 'FIN', 'ELSE', 'ALT', 'OUT']);
            }
        }

        if (!this.expectSemicolon("Expected ';' after RETURN.")) {
            this.synchronize([';', 'END', 'MODEND', 'FIN', 'ELSE', 'ALT', 'OUT']);
            this.acceptSemicolon();
        }
        return new ReturnStatementNode(
            this.tokenValue(keyword),
            opening ? this.tokenValue(opening) : undefined,
            expression,
            closing ? this.tokenValue(closing) : undefined
        );
    }
}
