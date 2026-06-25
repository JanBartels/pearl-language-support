// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Token, TokenKind } from './token';
import { TokenStream } from './tokenStream';

export class LexerTokenStream implements TokenStream {

    private index = 0;

    constructor(
        private readonly tokens: readonly Token[]
    ) {}

    current(): Token {
        return this.peek();
    }

    peek(offset = 0): Token {

        const index = Math.min(
            this.index + offset,
            this.tokens.length - 1
        );

        return this.tokens[index]!;
    }

    next(): void {

        if (!this.eof()) {
            this.index++;
        }
    }

    eof(): boolean {
        return this.current().kind === TokenKind.EOF;
    }
}
