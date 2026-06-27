// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Token, TokenKind } from './token';
import { TokenStream } from './tokenStream';
import { Source } from '../source/source';

export class LexerTokenStream implements TokenStream {

    private index = 0;

    constructor(
        private readonly tokens: readonly Token[],
        private readonly source: Source
    ) {}

    tokenText(token: Token): string {
        if (this.source !== token.location.source) {
            throw new Error('Token belongs to a different source.');
        }      
        return this.source.getText(token.location.span);
    }

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
