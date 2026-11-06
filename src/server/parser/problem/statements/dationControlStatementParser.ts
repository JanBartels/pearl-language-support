// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DationControlOptionNode } from '../../../ast/problem/statements/dationControlOptionNode';
import { DationControlStatementNode } from '../../../ast/problem/statements/dationControlStatementNode';
import type { SourceValue } from '../../../core/sourceValue';
import { ParserBase } from '../../parserBase';
import { ExpressionParser } from '../expressions/expressionParser';
import { NameExpressionParser } from '../expressions/nameExpressionParser';

const OPTIONS = ['IDF', 'NEW', 'OLD', 'ANY', 'EXCLUSIVE', 'CAN', 'PRM'] as const;
const BOUNDARIES = [
    'END', 'MODEND', 'FIN', 'ELSE', 'ALT', 'OUT', 'BEGIN', 'IF', 'CASE',
    'FOR', 'WHILE', 'REPEAT', 'RETURN', 'CALL', 'GOTO', 'OPEN', 'CLOSE',
    'READ', 'WRITE', 'GET', 'PUT', 'CONVERT',
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
            let expectsOption = true;
            while (!this.eof()) {
                this.skipTrivia();
                if (this.isOperator(';') || this.isKeyword(BOUNDARIES)) {
                    if (expectsOption) {
                        this.problems.error(this.location(), "Expected option after 'BY' or ','.");
                    }
                    break;
                }
                const option = this.parseOption();
                if (option) options.push(option);
                expectsOption = false;
                this.skipTrivia();
                const comma = this.acceptOperator(',');
                if (!comma) break;
                commas.push(this.tokenValue(comma));
                expectsOption = true;
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
        // RST is a format-list item, not an OPEN/CLOSE BY option in RTOS-UH.
        // Consume the rejected argument for local recovery, leaving any following
        // option and statement available to the normal parser.
        const invalidRst = this.acceptKeyword('RST');
        if (invalidRst) {
            this.problems.error(this.location(invalidRst),
                'RTOS-UH OPEN/CLOSE does not support RST(...).');
            this.skipTrivia();
            if (this.acceptOperator('(')) {
                this.synchronize([')', ',', ';', ...BOUNDARIES]);
                this.acceptOperator(')');
            }
            return undefined;
        }

        const keyword = this.acceptKeyword(OPTIONS);
        if (!keyword) {
            this.problems.error(this.location(), 'Expected OPEN/CLOSE BY option.');
            this.synchronize([',', ';', ...BOUNDARIES]);
            return undefined;
        }
        const value = this.tokenValue(keyword);
        if (value.value !== 'IDF') {
            return new DationControlOptionNode(value, undefined, undefined, undefined);
        }

        this.skipTrivia();
        const opening = this.acceptOperator('(');
        if (!opening) {
            this.problems.error(this.location(), `Expected '(' after ${value.value}.`);
            return new DationControlOptionNode(value, undefined, undefined, undefined);
        }

        const argument = new ExpressionParser(this.context).parse();
        if (!argument) {
            this.problems.error(this.location(), 'Expected CHARACTER expression in IDF(...).');
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
