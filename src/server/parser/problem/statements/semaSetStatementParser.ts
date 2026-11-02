// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SemaSetStatementNode } from '../../../ast/problem/statements/semaSetStatementNode';
import { ParserBase } from '../../parserBase';
import { ExpressionParser } from '../expressions/expressionParser';
import { NameExpressionParser } from '../expressions/nameExpressionParser';

/** RTOS-UH: SEMASET Expression ',' NameExpression ';'. */
export class SemaSetStatementParser extends ParserBase {
    override parse(): SemaSetStatementNode | undefined {
        this.skipTrivia();
        const keyword = this.acceptKeyword('SEMASET');
        if (!keyword) return undefined;
        const value = new ExpressionParser(this.context).parse();
        if (!value) this.problems.error(this.location(), 'Expected FIXED expression after SEMASET.');
        this.skipTrivia();
        const comma = this.acceptOperator(',');
        if (!comma) this.problems.error(this.location(), "Expected ',' after SEMASET value.");
        const sema = comma ? new NameExpressionParser(this.context).parse() : undefined;
        if (comma && !sema) this.problems.error(this.location(), 'Expected SEMA object after comma.');
        this.skipTrivia();
        if (!this.expectSemicolon('Expected semicolon after SEMASET statement.')) {
            this.synchronize([';', 'END', 'MODEND', 'FIN', 'ELSE', 'ALT', 'OUT']);
            this.acceptSemicolon();
        }
        return new SemaSetStatementNode(this.tokenValue(keyword), value,
            comma ? this.tokenValue(comma) : undefined, sema);
    }
}
