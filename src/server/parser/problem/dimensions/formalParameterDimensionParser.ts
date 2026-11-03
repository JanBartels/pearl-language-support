// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DimensionAttributeNode } from '../../../ast/problem/dimensions/dimensionAttributeNode';
import { VirtualDimensionListNode } from '../../../ast/problem/dimensions/virtualDimensionListNode';
import { TokenKind } from '../../../lexer/token';
import { ParserBase } from '../../parserBase';
import { DimensionAttributeParser } from './dimensionAttributeParser';
import { VirtualDimensionListParser } from './virtualDimensionListParser';

/** Formal parameters accept both virtual ranks `(,)` and UH array bounds
 * `(2000)`. The choice is made by token lookahead, not speculative parsing,
 * so AST origins and diagnostics are retained exactly once.
 */
export class FormalParameterDimensionParser extends ParserBase {
    override parse(): VirtualDimensionListNode | DimensionAttributeNode | undefined {
        this.skipTrivia();
        if (!this.isOperator('(')) return undefined;
        let offset = 1;
        let next = this.context.stream.peek(offset);
        while (next.kind === TokenKind.Comment || next.kind === TokenKind.Newline) {
            next = this.context.stream.peek(++offset);
        }
        const text = this.context.stream.tokenText(next);
        return text === ',' || text === ')'
            ? new VirtualDimensionListParser(this.context).parse()
            : new DimensionAttributeParser(this.context).parse();
    }
}
