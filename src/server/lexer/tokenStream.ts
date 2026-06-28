// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Token } from './token';
import { Span } from '../core/span';

export interface TokenStream {

    /**
     * Liefert das aktuelle Token.
     */
    current(): Token;

    /**
     * Liefert ein Token relativ zur aktuellen Position,
     * ohne den Stream weiterzubewegen.
     */
    peek(offset?: number): Token;

    /**
     * Bewegt den Stream um ein Token weiter.
     */
    next(): void;

    /**
     * Prüft, ob das Ende des Streams erreicht wurde.
     */
    eof(): boolean;

    /**
     * Gibt den Text des Tokens zurück
     */
    tokenText(token: Token): string;

    /**
     * Gibt den Originaltext des Spans zurück
     */
    getText(span: Span): string;    
}

export interface TokenMark {
    // abstract
}

export interface SeekableTokenStream extends TokenStream {

    mark(): TokenMark;

    reset(mark: TokenMark): void;
}
