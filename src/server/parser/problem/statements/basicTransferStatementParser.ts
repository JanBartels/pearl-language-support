// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { BasicTransferStatementNode } from '../../../ast/problem/statements/basicTransferStatementNode';
import type { ExpressionNode } from '../../../ast/problem/expressions/expressionNode';
import type { SourceValue } from '../../../core/sourceValue';
import { ParserBase } from '../../parserBase';
import { ExpressionParser } from '../expressions/expressionParser';
import { NameExpressionParser } from '../expressions/nameExpressionParser';

const BOUNDARIES = [
    'END', 'MODEND', 'FIN', 'ELSE', 'ALT', 'OUT', 'BEGIN', 'IF', 'CASE',
    'FOR', 'WHILE', 'REPEAT', 'RETURN', 'CALL', 'GOTO', 'OPEN', 'CLOSE',
    'READ', 'WRITE', 'GET', 'PUT', 'CONVERT', 'TAKE', 'SEND',
    'REQUEST', 'RELEASE', 'ENTER', 'LEAVE', 'RESERVE', 'FREE',
    'SEMASET', 'ACTIVATE', 'TERMINATE', 'SUSPEND', 'CONTINUE',
    'RESUME', 'PREVENT', 'ENABLE', 'DISABLE', 'TRIGGER'
] as const;

/** TAKE [name (',' name)*] FROM name ';'
 *  SEND [expression (',' expression)*] TO name ';'
 * RTOS-UH permits multiple objects, unlike the single-object language report.
 */
export class BasicTransferStatementParser extends ParserBase {
    override parse(): BasicTransferStatementNode | undefined {
        this.skipTrivia();
        const keyword = this.acceptKeyword(['TAKE', 'SEND']);
        if (!keyword) return undefined;
        const take = this.tokenText(keyword) === 'TAKE';
        const direction = take ? 'FROM' : 'TO';
        const objects: ExpressionNode[] = [];
        const commas: SourceValue<string>[] = [];

        this.skipTrivia();
        if (!this.isKeyword(direction) && !this.isOperator(';') && !this.isKeyword(BOUNDARIES)) {
            while (!this.eof()) {
                const object = take
                    ? new NameExpressionParser(this.context).parse()
                    : new ExpressionParser(this.context).parse();
                if (object) objects.push(object);
                else {
                    this.problems.error(this.location(),
                        `Expected ${take ? 'variable' : 'expression'} in ${this.tokenText(keyword)} data list.`);
                    this.synchronize([',', direction, ';', ...BOUNDARIES]);
                }
                this.skipTrivia();
                const comma = this.acceptOperator(',');
                if (!comma) break;
                commas.push(this.tokenValue(comma));
                this.skipTrivia();
                if (this.isKeyword(direction) || this.isOperator(';') || this.isKeyword(BOUNDARIES)) {
                    this.problems.error(this.location(), `Expected data object after ',' in ${this.tokenText(keyword)}.`);
                    break;
                }
            }
        }

        this.skipTrivia();
        let directionToken = this.acceptKeyword(direction);
        if (!directionToken) {
            this.problems.error(this.location(), `Expected '${direction}' in ${this.tokenText(keyword)} statement.`);
            this.synchronize([direction, ';', ...BOUNDARIES]);
            directionToken = this.acceptKeyword(direction);
        }

        this.skipTrivia();
        const dation = directionToken ? new NameExpressionParser(this.context).parse() : undefined;
        if (directionToken && !dation) {
            this.problems.error(this.location(), `Expected BASIC DATION after '${direction}'.`);
        }

        this.skipTrivia();
        const by = this.acceptKeyword('BY');
        if (by) {
            // Unlike the PEARL report, RTOS-UH rejects BY RST, S, CONTROL
            // before any format-specific semantic validation is meaningful.
            this.problems.error(this.location(by), 'RTOS-UH TAKE/SEND does not support BY options.');
            this.synchronize([';', ...BOUNDARIES]);
        }

        this.skipTrivia();
        const semicolon = this.acceptOperator(';');
        if (!semicolon) {
            this.problems.error(this.location(), `Expected ';' after ${this.tokenText(keyword)} statement.`);
            this.synchronize([';', ...BOUNDARIES]);
            this.acceptOperator(';');
        }
        return new BasicTransferStatementNode(
            this.tokenValue(keyword), objects, commas,
            directionToken ? this.tokenValue(directionToken) : undefined,
            dation, by ? this.tokenValue(by) : undefined,
            semicolon ? this.tokenValue(semicolon) : undefined
        );
    }
}
