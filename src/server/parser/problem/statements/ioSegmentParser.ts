// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { IoSegmentNode } from '../../../ast/problem/statements/ioSegmentNode';
import { NameExpressionNode } from '../../../ast/problem/expressions/nameExpressionNode';
import { NameSegmentNode } from '../../../ast/problem/expressions/nameSegmentNode';
import type { ExpressionNode } from '../../../ast/problem/expressions/expressionNode';
import type { SourceValue } from '../../../core/sourceValue';
import { TokenKind } from '../../../lexer/token';
import { ParserBase } from '../../parserBase';
import { ExpressionParser } from '../expressions/expressionParser';

/** The colon in the final dimension makes an I/O segment distinct from Name(...). */
export class IoSegmentParser extends ParserBase {
    /** Look ahead without consuming tokens or producing speculative diagnostics. */
    isSegment(): boolean {
        if (!this.isIdentifier()) return false;
        let offset = 0;
        const significant = () => {
            let token = this.context.stream.peek(offset++);
            while (token.kind === TokenKind.Comment || token.kind === TokenKind.Newline) {
                token = this.context.stream.peek(offset++);
            }
            return token;
        };
        let token = significant();
        if (!this.isIdentifier(token)) return false;
        token = significant();
        while (this.tokenText(token) === '.') {
            token = significant();
            if (!this.isIdentifier(token) && !this.isKeyword(['BIT', 'CHAR', 'CHARACTER'], token)) {
                return false;
            }
            token = significant();
        }
        if (!this.isOperator('(', token)) return false;
        let depth = 1;
        while (true) {
            token = significant();
            if (token.kind === TokenKind.EOF) return false;
            if (this.isOperator('(', token)) depth++;
            if (this.isOperator(')', token)) {
                depth--;
                if (depth === 0) return false;
            }
            if (depth === 1 && this.isOperator(':', token)) return true;
            if (depth === 1 && this.isOperator(';', token)) return false;
        }
        return false;
    }

    override parse(): IoSegmentNode | undefined {
        this.skipTrivia();
        const first = this.acceptIdentifier();
        if (!first) return undefined;
        const segments = [new NameSegmentNode(this.tokenValue(first))];
        while (true) {
            this.skipTrivia();
            const dot = this.acceptOperator('.');
            if (!dot) break;
            this.skipTrivia();
            const next = this.acceptIdentifier() ?? this.acceptKeyword(['BIT', 'CHAR', 'CHARACTER']);
            if (!next) {
                this.problems.error(this.location(), "Expected structure component after '.'.");
                break;
            }
            segments.push(new NameSegmentNode(this.tokenValue(next), this.tokenValue(dot)));
        }
        this.skipTrivia();
        const opening = this.acceptOperator('(');
        if (!opening) return undefined; // isSegment() has already confirmed the opening.
        const indices: ExpressionNode[] = [];
        const commas: SourceValue<string>[] = [];
        let lower: ExpressionNode | undefined;
        let upper: ExpressionNode | undefined;
        let colon: SourceValue<string> | undefined;
        while (!this.eof()) {
            this.skipTrivia();
            const value = new ExpressionParser(this.context).parse();
            if (!value) {
                this.problems.error(this.location(), 'Expected FIXED expression in I/O segment.');
                break;
            }
            this.skipTrivia();
            const comma = this.acceptOperator(',');
            if (comma) {
                indices.push(value);
                commas.push(this.tokenValue(comma));
                continue;
            }
            const separator = this.acceptOperator(':');
            if (separator) {
                lower = value;
                colon = this.tokenValue(separator);
                upper = new ExpressionParser(this.context).parse();
                if (!upper) this.problems.error(this.location(), "Expected upper index after ':'.");
            } else {
                this.problems.error(this.location(), "Expected ':' in the last dimension of I/O segment.");
            }
            break;
        }
        this.skipTrivia();
        let closing = this.acceptOperator(')');
        if (!closing) {
            this.problems.error(this.location(), "Expected ')' after I/O segment.");
            this.synchronize([')', ';', 'FROM', 'TO', 'BY']);
            closing = this.acceptOperator(')');
        }
        return new IoSegmentNode(new NameExpressionNode(segments), this.tokenValue(opening),
            indices, commas, lower, colon, upper,
            closing ? this.tokenValue(closing) : undefined);
    }
}
