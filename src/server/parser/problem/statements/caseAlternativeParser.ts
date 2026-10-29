// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../../core/sourceValue';
import { CaseIndexRangeNode } from '../../../ast/problem/statements/caseIndexRangeNode';
import { CaseAlternativeNode } from '../../../ast/problem/statements/caseAlternativeNode';
import { StatementExpressionParser } from '../expressions/statementExpressionParser';
import { ParserBase } from '../../parserBase';
import { BodyParser } from './bodyParser';

export class CaseAlternativeParser extends ParserBase {
    override parse(position = 1): CaseAlternativeNode | undefined {
        this.skipTrivia();
        const alt = this.acceptKeyword('ALT');
        if (!alt) return undefined;

        this.skipTrivia();
        const list = this.isOperator('(') ? this.parseCaseList() : undefined;
        const body = new BodyParser(this.context).parseStatements(['ALT', 'OUT', 'FIN']);
        return new CaseAlternativeNode(this.tokenValue(alt), list?.values, body, position, list?.ranges);
    }

    /** IndexRange ::= Expression [ ':' Expression ], separated by commas.
     * The shared ExpressionParser consumes the actual statement stream; all
     * delimiters remain under the responsibility of this grammar production.
     */
    private parseCaseList(): {
        values: SourceValue<string>[];
        ranges: CaseIndexRangeNode[];
    } {
        const list: SourceValue<string>[] = [];
        const ranges: CaseIndexRangeNode[] = [];
        const opening = this.acceptOperator('(')!;
        list.push(this.tokenValue(opening));
        let expectingValue = true;
        let closed = false;

        while (!this.eof()) {
            this.skipTrivia();
            const closing = this.acceptOperator(')');
            if (closing) {
                list.push(this.tokenValue(closing));
                closed = true;
                if (expectingValue) {
                    this.problems.error(this.location(closing),
                        'Expected a value in ALT case list.');
                }
                break;
            }
            if (this.isKeyword(['ALT', 'OUT', 'FIN', 'END', 'MODEND'])
                || this.isOperator(';')) break;

            const lower = new StatementExpressionParser(this.context).parseUntil(
                [':', ',', ')'], 'ALT case list'
            );
            list.push(...lower.values);
            if (!lower.values.length) {
                this.problems.error(this.location(), 'Expected constant in ALT range.');
                // An unexpected delimiter is owned by the enclosing list.
            }
            this.skipTrivia();
            const colon = this.acceptOperator(':');
            let upper: ReturnType<StatementExpressionParser['parseUntil']> | undefined;
            if (colon) {
                list.push(this.tokenValue(colon));
                upper = new StatementExpressionParser(this.context).parseUntil(
                    [',', ')'], 'ALT range'
                );
                list.push(...upper.values);
                if (!upper.values.length) {
                    this.problems.error(this.location(), 'Expected constant in ALT range.');
                }
            }
            if (lower.values.length || colon || upper) {
                ranges.push(new CaseIndexRangeNode(
                    lower.expression, colon ? this.tokenValue(colon) : undefined,
                    upper?.expression
                ));
            }
            expectingValue = false;
            this.skipTrivia();
            const comma = this.acceptOperator(',');
            if (comma) {
                list.push(this.tokenValue(comma));
                expectingValue = true;
                continue;
            }
            if (this.isOperator(')')) continue;
            // Missing ')' or unexpected token: do not swallow the next ALT.
            break;
        }
        if (!closed) {
            this.problems.error(this.location(), "Expected ')' after ALT case list.");
        }
        return { values: list, ranges };
    }
}
