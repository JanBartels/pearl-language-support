// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { FormattedIoStatementNode } from '../../../ast/problem/statements/formattedIoStatementNode';
import type { ExpressionNode } from '../../../ast/problem/expressions/expressionNode';
import type { SourceValue } from '../../../core/sourceValue';
import { ParserBase } from '../../parserBase';
import { ExpressionParser } from '../expressions/expressionParser';
import { NameExpressionParser } from '../expressions/nameExpressionParser';
import { IoSegmentParser } from './ioSegmentParser';
import { FormatListParser } from './formatListParser';

const BOUNDARIES = [
    'END', 'MODEND', 'FIN', 'ELSE', 'ALT', 'OUT', 'BEGIN', 'IF', 'CASE',
    'FOR', 'WHILE', 'REPEAT', 'RETURN', 'CALL', 'GOTO', 'OPEN', 'CLOSE',
    'READ', 'WRITE', 'GET', 'PUT', 'CONVERT', 'TAKE', 'SEND',
    'REQUEST', 'RELEASE', 'ENTER', 'LEAVE', 'RESERVE', 'FREE',
    'SEMASET', 'ACTIVATE', 'TERMINATE', 'SUSPEND', 'CONTINUE',
    'RESUME', 'PREVENT', 'ENABLE', 'DISABLE', 'TRIGGER'
] as const;

/** GET, PUT and CONVERT share the same list/format grammar.
 * Runtime format-list execution is deliberately outside this parser.
 */
export class FormattedIoStatementParser extends ParserBase {
    override parse(): FormattedIoStatementNode | undefined {
        this.skipTrivia();
        const keyword = this.acceptKeyword(['GET', 'PUT', 'CONVERT']);
        if (!keyword) return undefined;
        const name = this.tokenText(keyword);
        const input = name === 'GET';
        const output = name === 'PUT';
        const requiredDirection = input ? 'FROM' : output ? 'TO' : undefined;
        const objects: ExpressionNode[] = [];
        const commas: SourceValue<string>[] = [];
        this.skipTrivia();
        if (!this.isKeyword(['TO', 'FROM']) && !this.isOperator(';') && !this.isKeyword(BOUNDARIES)) {
            while (!this.eof()) {
                const segmentParser = new IoSegmentParser(this.context);
                const segment = name !== 'CONVERT' && segmentParser.isSegment()
                    ? segmentParser.parse() : undefined;
                const value = segment ?? (input
                    ? new NameExpressionParser(this.context).parse()
                    : new ExpressionParser(this.context).parse());
                if (value) objects.push(value);
                else {
                    this.problems.error(this.location(), `Expected ${input ? 'variable' : 'expression'} in ${name} data list.`);
                    this.synchronize([',', 'TO', 'FROM', ';', ...BOUNDARIES]);
                }
                this.skipTrivia();
                const comma = this.acceptOperator(',');
                if (!comma) break;
                commas.push(this.tokenValue(comma));
                this.skipTrivia();
                if (this.isKeyword(['TO', 'FROM']) || this.isOperator(';') || this.isKeyword(BOUNDARIES)) {
                    this.problems.error(this.location(), "Expected data object after ','.");
                    break;
                }
            }
        }
        this.skipTrivia();
        const direction = this.acceptKeyword(requiredDirection ?? ['FROM','TO']);
        if (!direction) {
            this.problems.error(this.location(), `Expected ${requiredDirection ?? "'FROM' or 'TO'"} in ${name} statement.`);
            this.synchronize(['TO', 'FROM', ';', ...BOUNDARIES]);
        }
        const recovered = direction ?? this.acceptKeyword(requiredDirection ?? ['FROM','TO']);
        this.skipTrivia();
        const target = recovered ? (name === 'CONVERT' && this.tokenText(recovered) === 'TO'
            ? new NameExpressionParser(this.context).parse()
            : name === 'CONVERT'
                ? new ExpressionParser(this.context).parse()
                : new NameExpressionParser(this.context).parse()) : undefined;
        if (recovered && !target) this.problems.error(this.location(), `Expected ${name === 'CONVERT' ? 'CHARACTER' : 'DATION'} after ${this.tokenText(recovered)}.`);
        this.skipTrivia();
        const by = this.acceptKeyword('BY');
        const formats = by ? new FormatListParser(this.context, name === 'CONVERT').parse() : undefined;
        this.skipTrivia();
        const semicolon = this.acceptOperator(';');
        if (!semicolon) {
            this.problems.error(this.location(), `Expected ';' after ${name} statement.`);
            this.synchronize([';', ...BOUNDARIES]);
            this.acceptOperator(';');
        }
        return new FormattedIoStatementNode(this.tokenValue(keyword), objects, commas,
            recovered ? this.tokenValue(recovered) : undefined, target,
            by ? this.tokenValue(by) : undefined, formats,
            semicolon ? this.tokenValue(semicolon) : undefined);
    }
}
