// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DationControlOptionNode } from '../../../ast/problem/statements/dationControlOptionNode';
import { DationControlStatementNode } from '../../../ast/problem/statements/dationControlStatementNode';
import type { SourceValue } from '../../../core/sourceValue';
import { ParserBase } from '../../parserBase';
import { ExpressionParser } from '../expressions/expressionParser';
import { NameExpressionParser } from '../expressions/nameExpressionParser';

const OPTIONS = ['IDF', 'RST', 'NEW', 'OLD', 'ANY', 'EXCLUSIVE', 'CAN', 'PRM'] as const;
const BOUNDARIES = [
    'END', 'MODEND', 'FIN', 'ELSE', 'ALT', 'OUT', 'BEGIN', 'IF', 'CASE',
    'FOR', 'WHILE', 'REPEAT', 'RETURN', 'CALL', 'GOTO', 'OPEN', 'CLOSE',
    'READ', 'WRITE',
    'REQUEST', 'RELEASE', 'ENTER', 'LEAVE', 'RESERVE', 'FREE',
    'SEMASET', 'ACTIVATE', 'TERMINATE', 'SUSPEND', 'CONTINUE',
    'RESUME', 'PREVENT', 'ENABLE', 'DISABLE', 'TRIGGER'
] as const;

/** Common grammar and local recovery for OPEN and CLOSE. Validity of options is semantic. */
export class DationControlStatementParser extends ParserBase {
    override parse(): DationControlStatementNode | undefined {
        this.skipTrivia();
        const keyword = this.acceptKeyword(['OPEN', 'CLOSE']);
        if (!keyword) return undefined;

        const dation = new NameExpressionParser(this.context).parse();
        if (!dation) {
            this.problems.error(this.location(), `Expected DATION after ${this.tokenText(keyword)}.`);
        }

        this.skipTrivia();
        const byToken = this.acceptKeyword('BY');
        const options: DationControlOptionNode[] = [];
        const commas: SourceValue<string>[] = [];
        if (byToken) {
            while (!this.eof()) {
                this.skipTrivia();
                if (this.isOperator(';') || this.isKeyword(BOUNDARIES)) {
                    if (options.length === commas.length) {
                        this.problems.error(this.location(), "Expected option after 'BY' or ','.");
                    }
                    break;
                }
                const option = this.parseOption();
                if (option) options.push(option);
                this.skipTrivia();
                const comma = this.acceptOperator(',');
                if (!comma) break;
                commas.push(this.tokenValue(comma));
            }
        }

        this.skipTrivia();
        const semicolon = this.acceptOperator(';');
        if (!semicolon) {
            this.problems.error(this.location(), `Expected ';' after ${this.tokenText(keyword)} statement.`);
            this.synchronize([';', ...BOUNDARIES]);
            this.acceptOperator(';');
        }
        return new DationControlStatementNode(
            this.tokenValue(keyword), dation,
            byToken ? this.tokenValue(byToken) : undefined,
            options, commas,
            semicolon ? this.tokenValue(semicolon) : undefined
        );
    }

    private parseOption(): DationControlOptionNode | undefined {
        const keyword = this.acceptKeyword(OPTIONS);
        if (!keyword) {
            this.problems.error(this.location(), 'Expected OPEN/CLOSE BY option.');
            this.synchronize([',', ';', ...BOUNDARIES]);
            return undefined;
        }
        const value = this.tokenValue(keyword);
        if (value.value !== 'IDF' && value.value !== 'RST') {
            return new DationControlOptionNode(value, undefined, undefined, undefined);
        }

        this.skipTrivia();
        const opening = this.acceptOperator('(');
        if (!opening) {
            this.problems.error(this.location(), `Expected '(' after ${value.value}.`);
            return new DationControlOptionNode(value, undefined, undefined, undefined);
        }

        const argument = value.value === 'IDF'
            ? new ExpressionParser(this.context).parse()
            : new NameExpressionParser(this.context).parse();
        if (!argument) {
            this.problems.error(this.location(), `Expected ${value.value === 'IDF' ? 'CHARACTER expression' : 'FIXED variable'} in ${value.value}(...).`);
        }

        this.skipTrivia();
        let closing = this.acceptOperator(')');
        if (!closing) {
            this.problems.error(this.location(), `Expected ')' after ${value.value} argument.`);
            this.synchronize([')', ',', ';', ...BOUNDARIES]);
            closing = this.acceptOperator(')');
        }
        return new DationControlOptionNode(value, this.tokenValue(opening), argument,
            closing ? this.tokenValue(closing) : undefined);
    }
}
