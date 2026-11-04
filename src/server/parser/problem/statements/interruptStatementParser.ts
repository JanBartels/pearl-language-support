// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { InterruptStatementNode } from '../../../ast/problem/statements/interruptStatementNode';
import { ParserBase } from '../../parserBase';
import { NameExpressionParser } from '../expressions/nameExpressionParser';

const RECOVERY = [
    ';', 'END', 'MODEND', 'FIN', 'ELSE', 'ALT', 'OUT',
    'BEGIN', 'IF', 'CASE', 'FOR', 'WHILE', 'REPEAT',
    'RETURN', 'CALL', 'GOTO', 'REQUEST', 'RELEASE', 'ENTER', 'LEAVE',
    'RESERVE', 'FREE', 'SEMASET', 'ACTIVATE', 'TERMINATE', 'SUSPEND',
    'CONTINUE', 'RESUME', 'PREVENT', 'ENABLE', 'DISABLE', 'TRIGGER',
    'READ', 'WRITE'
] as const;

/** RTOS-UH interrupt control: (ENABLE | DISABLE | TRIGGER) Name ';'. */
export class InterruptStatementParser extends ParserBase {
    override parse(): InterruptStatementNode | undefined {
        this.skipTrivia();
        const keyword = this.acceptKeyword(['ENABLE', 'DISABLE', 'TRIGGER']);
        if (!keyword) return undefined;

        const interrupt = new NameExpressionParser(this.context).parse();
        if (!interrupt) {
            this.problems.error(this.location(),
                `Expected interrupt name after '${this.tokenText(keyword)}'.`);
        }

        this.skipTrivia();
        const semicolon = this.acceptOperator(';');
        if (!semicolon) {
            this.problems.error(this.location(),
                `Expected ';' after ${this.tokenText(keyword)} statement.`);
            this.synchronize(RECOVERY);
            this.acceptOperator(';');
        }

        return new InterruptStatementNode(
            this.tokenValue(keyword), interrupt,
            semicolon ? this.tokenValue(semicolon) : undefined
        );
    }
}
