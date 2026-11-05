// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { BinaryTransferSFormatNode } from '../../../ast/problem/statements/binaryTransferSFormatNode';
import { BinaryTransferStatementNode } from '../../../ast/problem/statements/binaryTransferStatementNode';
import type { ExpressionNode } from '../../../ast/problem/expressions/expressionNode';
import type { SourceValue } from '../../../core/sourceValue';
import { ParserBase } from '../../parserBase';
import { ExpressionParser } from '../expressions/expressionParser';
import { NameExpressionParser } from '../expressions/nameExpressionParser';
import { IoSegmentParser } from './ioSegmentParser';

const BOUNDARIES = [
    'END', 'MODEND', 'FIN', 'ELSE', 'ALT', 'OUT', 'BEGIN', 'IF', 'CASE',
    'FOR', 'WHILE', 'REPEAT', 'RETURN', 'CALL', 'GOTO', 'OPEN', 'CLOSE',
    'READ', 'WRITE', 'GET', 'PUT', 'CONVERT', 'TAKE', 'SEND',
    'REQUEST', 'RELEASE', 'ENTER', 'LEAVE', 'RESERVE', 'FREE',
    'SEMASET', 'ACTIVATE', 'TERMINATE', 'SUSPEND', 'CONTINUE',
    'RESUME', 'PREVENT', 'ENABLE', 'DISABLE', 'TRIGGER'
] as const;

/** Parses RTOS-UH's binary transfer statements, including BY S(...). */
export class BinaryTransferStatementParser extends ParserBase {
    override parse(): BinaryTransferStatementNode | undefined {
        this.skipTrivia();
        const keyword = this.acceptKeyword(['READ', 'WRITE']);
        if (!keyword) return undefined;
        const read = this.tokenText(keyword) === 'READ';
        const direction = read ? 'FROM' : 'TO';

        const objects: ExpressionNode[] = [];
        const objectCommas: SourceValue<string>[] = [];
        this.skipTrivia();
        if (!this.isKeyword(direction) && !this.isOperator(';') && !this.isKeyword(BOUNDARIES)) {
            while (!this.eof()) {
                const segmentParser = new IoSegmentParser(this.context);
                const segment = segmentParser.isSegment();
                // RTOS-UH 5.7.5 documents complete ARRAY transfers, not
                // last-dimension slices. The original compiler rejects
                // WRITE Values(2:4) and WRITE Matrix(1,2:3) (reference test 11).
                // Still parse the invalid segment for recovery and symbol lookup;
                // IoSegment remains available for future formatted I/O.
                const rejectedSegment = segment ? segmentParser.parse() : undefined;
                const value = segment ? rejectedSegment
                    : read ? new NameExpressionParser(this.context).parse()
                    : new ExpressionParser(this.context).parse();
                if (rejectedSegment) {
                    this.problems.error(rejectedSegment.opening.location ?? this.location(),
                        'RTOS-UH READ/WRITE does not support array segments; transfer the complete array.');
                }
                if (!value) {
                    this.problems.error(this.location(), `Expected ${read ? 'variable' : 'expression'} in ${this.tokenText(keyword)} list.`);
                    this.synchronize([',', direction, ';', ...BOUNDARIES]);
                } else {
                    objects.push(value);
                }
                this.skipTrivia();
                const comma = this.acceptOperator(',');
                if (!comma) break;
                objectCommas.push(this.tokenValue(comma));
                this.skipTrivia();
                if (this.isKeyword(direction) || this.isOperator(';') || this.isKeyword(BOUNDARIES)) {
                    this.problems.error(this.location(), `Expected ${read ? 'variable' : 'expression'} after ','.`);
                    break;
                }
            }
        }

        this.skipTrivia();
        const directionToken = this.acceptKeyword(direction);
        if (!directionToken) {
            this.problems.error(this.location(), `Expected '${direction}' in ${this.tokenText(keyword)} statement.`);
            this.synchronize([direction, ';', ...BOUNDARIES]);
        }
        const recoveredDirection = directionToken ?? this.acceptKeyword(direction);
        this.skipTrivia();
        const dation = recoveredDirection ? new ExpressionParser(this.context).parse() : undefined;
        if (recoveredDirection && !dation) {
            this.problems.error(this.location(), `Expected DATION expression after '${direction}'.`);
        }

        this.skipTrivia();
        const byToken = this.acceptKeyword('BY');
        const formats: BinaryTransferSFormatNode[] = [];
        const formatCommas: SourceValue<string>[] = [];
        if (byToken) {
            while (!this.eof()) {
                this.skipTrivia();
                if (this.isOperator(';') || this.isKeyword(BOUNDARIES)) {
                    if (formats.length === formatCommas.length) {
                        this.problems.error(this.location(), "Expected S(...) after 'BY' or ','.");
                    }
                    break;
                }
                const format = this.parseSFormat();
                if (format) formats.push(format);
                this.skipTrivia();
                const comma = this.acceptOperator(',');
                if (!comma) break;
                formatCommas.push(this.tokenValue(comma));
            }
        }

        this.skipTrivia();
        const semicolon = this.acceptOperator(';');
        if (!semicolon) {
            this.problems.error(this.location(), `Expected ';' after ${this.tokenText(keyword)} statement.`);
            this.synchronize([';', ...BOUNDARIES]);
            this.acceptOperator(';');
        }
        return new BinaryTransferStatementNode(
            this.tokenValue(keyword), objects, objectCommas,
            recoveredDirection ? this.tokenValue(recoveredDirection) : undefined,
            dation, byToken ? this.tokenValue(byToken) : undefined,
            formats, formatCommas, semicolon ? this.tokenValue(semicolon) : undefined
        );
    }

    private parseSFormat(): BinaryTransferSFormatNode | undefined {
        const keyword = this.acceptKeyword('S');
        if (!keyword) {
            this.problems.error(this.location(), 'RTOS-UH READ/WRITE BY expects S(FIXED(31)-variable).');
            this.synchronize([',', ';', ...BOUNDARIES]);
            return undefined;
        }
        this.skipTrivia();
        const opening = this.acceptOperator('(');
        if (!opening) {
            this.problems.error(this.location(), "Expected '(' after S.");
            return new BinaryTransferSFormatNode(this.tokenValue(keyword), undefined, undefined, undefined);
        }
        const variable = new NameExpressionParser(this.context).parse();
        if (!variable) this.problems.error(this.location(), 'Expected FIXED(31) variable in S(...).');
        this.skipTrivia();
        let closing = this.acceptOperator(')');
        if (!closing) {
            this.problems.error(this.location(), "Expected ')' after S variable.");
            this.synchronize([')', ',', ';', ...BOUNDARIES]);
            closing = this.acceptOperator(')');
        }
        return new BinaryTransferSFormatNode(this.tokenValue(keyword),
            this.tokenValue(opening), variable,
            closing ? this.tokenValue(closing) : undefined);
    }
}
