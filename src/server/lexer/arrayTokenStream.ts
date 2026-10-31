// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Span } from '../core/span';
import { Source } from '../source/source';
import { Token, TokenKind } from './token';
import { TokenStream } from './tokenStream';

/** Token stream over a fully lexed source, without preprocessing a second time. */
export class ArrayTokenStream implements TokenStream {
    private index = 0;

    constructor(
        private readonly tokens: readonly Token[],
        private readonly source: Source
    ) {
        if (tokens.length === 0 || tokens[tokens.length - 1]?.kind !== TokenKind.EOF) {
            throw new Error('ArrayTokenStream requires a terminating EOF token.');
        }
    }

    current(): Token {
        return this.peek();
    }

    peek(offset = 0): Token {
        if (offset < 0) throw new RangeError('Negative token lookahead.');
        return this.tokens[Math.min(this.index + offset, this.tokens.length - 1)]!;
    }

    next(): void {
        if (!this.eof()) this.index++;
    }

    eof(): boolean {
        return this.current().kind === TokenKind.EOF;
    }

    tokenText(token: Token): string {
        return token.location.source.getText(token.location.span);
    }

    getText(span: Span): string {
        return this.source.getText(span);
    }
}
