// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../../core/sourceValue';
import { ReturnStatementNode } from '../../../ast/problem/statements/returnStatementNode';
import { ParserBase } from '../../parserBase';

/** RETURN [ '(' Expression ')' ] ';'. Expressions remain source tokens for now. */
export class ReturnStatementParser extends ParserBase {
    override parse(): ReturnStatementNode | undefined {
        this.skipTrivia();
        const keyword = this.acceptKeyword('RETURN');
        if (!keyword) return undefined;
        this.skipTrivia();

        let expression: SourceValue<string>[] | undefined;
        if (this.acceptLeftParenthesis()) {
            expression = [];
            let depth = 1;
            while (!this.eof()) {
                this.skipTrivia();
                if (this.eof() || this.isOperator(';') || this.isKeyword([
                    'END', 'MODEND', 'FIN', 'ELSE', 'ALT', 'OUT'
                ])) break;

                const token = this.current();
                if (this.isOperator('(')) depth++;
                if (this.isOperator(')')) {
                    depth--;
                    if (depth === 0) {
                        this.next();
                        break;
                    }
                }
                expression.push(this.tokenValue(token));
                this.next();
            }
            if (depth !== 0) {
                this.problems.error(this.location(), "Expected ')' after RETURN expression.");
            }
            if (expression.length === 0) {
                this.problems.error(this.location(), 'Expected expression in RETURN.');
            }
        }

        if (!this.expectSemicolon("Expected ';' after RETURN.")) {
            this.synchronize([';', 'END', 'MODEND', 'FIN', 'ELSE', 'ALT', 'OUT']);
            this.acceptSemicolon();
        }
        return new ReturnStatementNode(this.tokenValue(keyword), expression);
    }
}
