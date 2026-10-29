// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { Span } from '../core/span';
import { TokenKind, type Token } from '../lexer/token';
import type { TokenStream } from '../lexer/tokenStream';

/** Lazy lookahead over a forward-only preprocessed stream.
 * Macro expansion remains owned by the preprocessor. The parser can inspect
 * ambiguous statement tails without consuming the tokens it inspects.
 * No expression is parsed twice and no speculative diagnostics are produced.
 */
export class LookaheadTokenStream implements TokenStream {
    private pending: Token[];

    constructor(private readonly input: TokenStream) {
        this.pending = [input.current()];
    }

    current(): Token { return this.pending[0]; }

    peek(offset = 0): Token {
        while (this.pending.length <= offset
            && this.pending[this.pending.length - 1].kind !== TokenKind.EOF) {
            this.input.next();
            this.pending.push(this.input.current());
        }
        return this.pending[Math.min(offset, this.pending.length - 1)];
    }

    next(): void {
        if (this.eof()) return;
        if (this.pending.length > 1) this.pending.shift();
        else {
            this.input.next();
            this.pending[0] = this.input.current();
        }
    }
    eof(): boolean { return this.current().kind === TokenKind.EOF; }
    tokenText(token: Token): string { return this.input.tokenText(token); }
    getText(span: Span): string { return this.input.getText(span); }
}
