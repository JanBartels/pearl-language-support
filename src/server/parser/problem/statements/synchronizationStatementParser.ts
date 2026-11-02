// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SynchronizationStatementNode } from '../../../ast/problem/statements/synchronizationStatementNode';
import { NameExpressionNode } from '../../../ast/problem/expressions/nameExpressionNode';
import { SourceValue } from '../../../core/sourceValue';
import { ParserBase } from '../../parserBase';
import { NameExpressionParser } from '../expressions/nameExpressionParser';

/** A nonempty comma-separated list of synchronization objects. */
export class SynchronizationStatementParser extends ParserBase {
    override parse(): SynchronizationStatementNode | undefined {
        this.skipTrivia();
        const keyword = this.acceptKeyword([
            'REQUEST', 'RELEASE', 'ENTER', 'LEAVE', 'RESERVE', 'FREE'
        ]);
        if (!keyword) return undefined;

        const operands: NameExpressionNode[] = [];
        const commas: SourceValue<string>[] = [];
        while (true) {
            this.skipTrivia();
            const operand = new NameExpressionParser(this.context).parse();
            if (!operand) {
                this.problems.error(this.location(),
                    `Expected synchronization object after '${this.tokenValue(keyword).value}'.`);
                break;
            }
            operands.push(operand);
            this.skipTrivia();
            const comma = this.acceptOperator(',');
            if (!comma) break;
            commas.push(this.tokenValue(comma));
        }

        this.skipTrivia();
        if (!this.expectSemicolon('Expected semicolon after synchronization statement.')) {
            this.synchronize([';', 'END', 'MODEND', 'FIN', 'ELSE', 'ALT', 'OUT']);
            this.acceptSemicolon();
        }
        return new SynchronizationStatementNode(this.tokenValue(keyword), operands, commas);
    }
}
