// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { FormatListNode } from '../../../ast/problem/statements/formatListNode';
import { FormatItemNode } from '../../../ast/problem/statements/formatItemNode';
import { FormatReferenceNode } from '../../../ast/problem/statements/formatReferenceNode';
import type { ExpressionNode } from '../../../ast/problem/expressions/expressionNode';
import type { SourceValue } from '../../../core/sourceValue';
import { ParserBase } from '../../parserBase';
import type { ParserContext } from '../../parserContext';
import { ExpressionParser } from '../expressions/expressionParser';
import { NameExpressionParser } from '../expressions/nameExpressionParser';

/** Formats actually documented in RTOS-UH 5.5.7-5.5.9; no unimplemented
 * PEARL-90 positioning formats are silently treated as supported. */
const FORMAT_NAMES = ['F', 'E', 'A', 'B', 'B1', 'B3', 'B4', 'T', 'D', 'LIST',
    'R', 'RST', 'X', 'SKIP', 'PAGE'] as const;
const IO_BOUNDARIES = [
    'END', 'MODEND', 'FIN', 'ELSE', 'ALT', 'OUT', 'BEGIN', 'IF', 'CASE',
    'FOR', 'WHILE', 'REPEAT', 'RETURN', 'CALL', 'GOTO', 'OPEN', 'CLOSE',
    'READ', 'WRITE', 'GET', 'PUT', 'CONVERT', 'TAKE', 'SEND',
    'REQUEST', 'RELEASE', 'ENTER', 'LEAVE', 'RESERVE', 'FREE',
    'SEMASET', 'ACTIVATE', 'TERMINATE', 'SUSPEND', 'CONTINUE',
    'RESUME', 'PREVENT', 'ENABLE', 'DISABLE', 'TRIGGER'
] as const;

/** Common syntax tree for format lists in statements and FORMAT declarations.
 * Recursion is syntactic, never an eager unrolling of repetitions or R labels.
 */
export class FormatListParser extends ParserBase {
    constructor(context: ParserContext,
        private readonly allowConvertS = false) { super(context); }

    override parse(): FormatListNode { return this.parseList(false); }

    /** Parenthesized FORMAT declaration or nested format group. */
    parseParenthesized(): FormatListNode {
        this.skipTrivia();
        const open = this.acceptOperator('(');
        if (!open) this.problems.error(this.location(), "Expected '(' before format list.");
        return this.parseList(!!open, open ? this.tokenValue(open) : undefined);
    }

    private parseList(parenthesized: boolean, opening?: SourceValue<string>): FormatListNode {
        const items: FormatItemNode[] = [];
        const commas: SourceValue<string>[] = [];
        let needItem = true;
        while (!this.eof()) {
            this.skipTrivia();
            if (this.isOperator(';') || this.isKeyword(IO_BOUNDARIES)
                || (parenthesized && this.isOperator(')'))) {
                if (needItem) this.problems.error(this.location(), 'Expected format after BY, opening parenthesis or comma.');
                break;
            }
            // A missing ')' must not consume the next statement.
            if (parenthesized && this.isKeyword('BY')) break;
            const item = this.parseItem();
            if (!item) {
                this.problems.error(this.location(), 'Expected RTOS-UH format.');
                this.synchronize([',', ')', ';', ...IO_BOUNDARIES]);
            } else {
                items.push(item);
            }
            needItem = false;
            this.skipTrivia();
            const comma = this.acceptOperator(',');
            if (!comma) break;
            commas.push(this.tokenValue(comma));
            needItem = true;
        }
        this.skipTrivia();
        const close = parenthesized ? this.acceptOperator(')') : undefined;
        if (parenthesized && !close) this.problems.error(this.location(), "Expected ')' after format group.");
        return new FormatListNode(opening, items, commas, close ? this.tokenValue(close) : undefined);
    }

    private parseItem(): FormatItemNode | undefined {
        this.skipTrivia();
        let repeatOpening: SourceValue<string> | undefined;
        let repeatCount: ExpressionNode | undefined;
        let repeatClosing: SourceValue<string> | undefined;
        if (this.isOperator('(')) {
            const opening = this.acceptOperator('(')!;
            repeatOpening = this.tokenValue(opening);
            repeatCount = new ExpressionParser(this.context).parse();
            if (!repeatCount) this.problems.error(this.location(), 'Expected repetition count in format list.');
            this.skipTrivia();
            const closing = this.acceptOperator(')');
            if (!closing) this.problems.error(this.location(), "Expected ')' after format repetition count.");
            repeatClosing = closing ? this.tokenValue(closing) : undefined;
        }
        this.skipTrivia();
        if (repeatOpening && this.isOperator('(')) {
            const group = this.parseParenthesized();
            return new FormatItemNode(undefined, undefined, [], [], undefined, undefined,
                group, repeatOpening, repeatCount, repeatClosing);
        }
        const keyword = this.acceptKeyword([...FORMAT_NAMES, ...(this.allowConvertS ? ['S'] : [])]);
        if (!keyword) return undefined;
        const name = this.tokenText(keyword);
        this.skipTrivia();
        const open = this.acceptOperator('(');
        const argumentsList: ExpressionNode[] = [];
        const argumentCommas: SourceValue<string>[] = [];
        let reference: FormatReferenceNode | undefined;
        let close: SourceValue<string> | undefined;
        if (open) {
            this.skipTrivia();
            if (name === 'R') {
                const identifier = this.acceptIdentifier();
                if (!identifier) this.problems.error(this.location(), 'Expected FORMAT declaration name in R(...).');
                else reference = new FormatReferenceNode(this.tokenValue(identifier));
            } else if (name === 'RST' || name === 'S') {
                const variable = new NameExpressionParser(this.context).parse();
                if (variable) argumentsList.push(variable);
                else this.problems.error(this.location(), `Expected variable in ${name}(...).`);
            } else {
                if (!this.isOperator(')')) {
                    while (!this.eof()) {
                        const arg = new ExpressionParser(this.context).parse();
                        if (arg) argumentsList.push(arg);
                        else this.problems.error(this.location(), `Expected expression in ${name}(...).`);
                        this.skipTrivia();
                        const comma = this.acceptOperator(',');
                        if (!comma) break;
                        argumentCommas.push(this.tokenValue(comma));
                        this.skipTrivia();
                        if (this.isOperator(')') || this.isOperator(';')) {
                            this.problems.error(this.location(), 'Expected expression after format comma.');
                            break;
                        }
                    }
                }
            }
            this.skipTrivia();
            const closing = this.acceptOperator(')');
            if (!closing) {
                this.problems.error(this.location(), `Expected ')' after ${name} format.`);
                this.synchronize([')', ',', ';', ...IO_BOUNDARIES]);
                const recovered = this.acceptOperator(')');
                close = recovered ? this.tokenValue(recovered) : undefined;
            } else close = this.tokenValue(closing);
        } else if (['F','E','T','D','R','RST','S'].includes(name)) {
            this.problems.error(this.location(), `Expected '(' after ${name} format.`);
        }
        const count = argumentsList.length;
        const bounds = name === 'F' || name === 'E' ? [1, 3]
            : name === 'T' || name === 'D' ? [1, 2]
            : name === 'R' || name === 'RST' || name === 'S' ? [1, 1]
            : name === 'LIST' ? [0, 0] : [0, 1];
        if (open && (name === 'LIST' ||
            (count === 0 && ['A', 'B', 'B1', 'B3', 'B4', 'X', 'SKIP', 'PAGE'].includes(name)))) {
            this.problems.error(this.location(keyword),
                `${name} does not permit an empty argument list.`);
        }
        const actualCount = name === 'R' && reference ? 1 : count;
        if (actualCount < bounds[0] || actualCount > bounds[1]) {
            this.problems.error(this.location(keyword),
                `${name} expects ${bounds[0]}..${bounds[1]} format argument(s).`);
        }
        return new FormatItemNode(this.tokenValue(keyword), open ? this.tokenValue(open) : undefined,
            argumentsList, argumentCommas, close, reference, undefined,
            repeatOpening, repeatCount, repeatClosing);
    }
}
