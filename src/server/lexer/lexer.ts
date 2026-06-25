// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { CharStream } from './charStream';
import { TokenKind, Token } from './token';
import { createToken } from './tokenFactory';
import { Span } from '../core/span';
import { Location } from '../core/location';

export class Lexer {

  private readonly stream: CharStream;

  constructor(stream: CharStream) {
    this.stream = stream;
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];

    while (true) {
      const token = this.nextToken();
      if (!token) {
        throw new Error(
          `nextToken() returned undefined at offset ${this.stream.offset}`
        );
      }      
      tokens.push(token);

      if (token.kind === TokenKind.EOF) {
        break;
      }
    }

    return tokens;
  }

  private nextToken(): Token {

    const ch = this.stream.peek();

    if (ch === -1) {
      return this.createZeroLengthToken(TokenKind.EOF);
    }

    // Newline
    if (ch === 10 /* \n */ || ch === 13 /* \r */) {
      return this.lexNewline();
    }

    // Whitespace (space + tab)
    if (isWhitespace(ch)) {
      this.skipWhitespace();
      return this.nextToken();
    }

    // Comment starting with !
    if (ch === 33 /* ! */) {
      return this.lexLineComment();
    }

    // Preprocessor directive
    if (ch === 35 /* # */) {
      return this.lexPreprocessorDirective();
    }

    // Identifier
    if (isIdentifierStart(ch)) {
      return this.lexIdentifier();
    }

    // Number
    if (isDigit(ch)) {
      return this.lexNumber();
    }

    // String / Bit literal
    if (ch === 39 /* ' */) {
      return this.lexStringOrBitLiteral();
    }

    // Fallback: operator / punctuation (single char for now)
    return this.lexOperator();
  }

  // -----------------------------
  // Lexing helpers
  // -----------------------------

  private lexNewline(): Token {

    const start = this.stream.mark();
    const ch = this.stream.next();

    if (ch === 13 /* \r */ && this.stream.peek() === 10 /* \n */) {
      this.stream.next();
    }

    return this.createTokenFromSpan(TokenKind.Newline, start);
  }

  private skipWhitespace(): void {

    while (isWhitespace(this.stream.peek())) {
      this.stream.next();
    }
  }

  private lexLineComment(): Token {

    const start = this.stream.mark();

    this.stream.next(); // consume !

    while (true) {
      const ch = this.stream.peek();
      if (ch === -1 || ch === 10 || ch === 13) {
        break;
      }
      this.stream.next();
    }

    return this.createTokenFromSpan(TokenKind.Comment, start);
  }

  private lexIdentifier(): Token {

    const start = this.stream.mark();

    this.stream.next();

    while (isIdentifierPart(this.stream.peek())) {
      this.stream.next();
    }

    return this.createTokenFromSpan(TokenKind.Identifier, start);
  }

  private lexNumber(): Token {

    const start = this.stream.mark();

    while (isDigit(this.stream.peek())) {
      this.stream.next();
    }

    return this.createTokenFromSpan(TokenKind.NumberLiteral, start);
  }

  private lexStringOrBitLiteral(): Token {

    const start = this.stream.mark();

    this.stream.next(); // opening '

    while (true) {
      const ch = this.stream.peek();

      if (ch === -1) {
        break; // unterminated string
      }

      if (ch === 39 /* ' */) {
        this.stream.next(); // consume closing '
        break;
      }

      this.stream.next();
    }

    const afterQuote = this.stream.peek();

    // Bit literal suffix: B or B1–B4 (no whitespace allowed)
    if (afterQuote === 66 /* B */) {

      this.stream.next(); // consume B

      const next = this.stream.peek();

      if (next >= 49 && next <= 52) { // '1'..'4'
        this.stream.next();
      }

      return this.createTokenFromSpan(TokenKind.BitLiteral, start);
    }

    return this.createTokenFromSpan(TokenKind.StringLiteral, start);
  }

  private lexPreprocessorDirective(): Token {

    const start = this.stream.mark();

    this.stream.next(); // '#'

    const first = this.stream.peek();

    if (!isLetter(first)) {
      return this.createTokenFromSpan(
        TokenKind.InvalidDirective,
        start
      );
    }

    const upper = isUppercase(first);
    this.stream.next();

    while (true) {

      const ch = this.stream.peek();

      if (upper) {
        if (!isUppercase(ch)) {
          break;
        }
      } else {
        if (!isLowercase(ch)) {
          break;
        }
      }

      this.stream.next();
    }

    // Gemischte Groß-/Kleinschreibung?
    if (isLetter(this.stream.peek())) {

      while (isLetter(this.stream.peek())) {
        this.stream.next();
      }

      return this.createTokenFromSpan(
        TokenKind.InvalidDirective,
        start
      );
    }

    return this.createTokenFromSpan(
      TokenKind.PreprocessorDirective,
      start
    );
  }

  private lexOperator(): Token {

    const start = this.stream.mark();
    this.stream.next();

    return this.createTokenFromSpan(TokenKind.Operator, start);
  }

  // -----------------------------
  // Token creation helpers
  // -----------------------------

  private createZeroLengthToken(kind: TokenKind): Token {

    const offset = this.stream.offset;

    const span: Span = {
      start: offset,
      end: offset
    };

    const location: Location = {
      uri: this.stream.uri,
      span
    };

    return createToken(kind, location);
  }

  private createTokenFromSpan(kind: TokenKind, start: number): Token {

    const span: Span = {
      start,
      end: this.stream.offset
    };

    const location: Location = {
      uri: this.stream.uri,
      span
    };

    return createToken(kind, location);
  }
}

// --------------------------------
// ASCII helper functions
// --------------------------------

function isWhitespace(ch: number): boolean {
  return ch === 32 /* space */ || ch === 9 /* tab */;
}

function isDigit(ch: number): boolean {
  return ch >= 48 && ch <= 57;
}

function isIdentifierStart(ch: number): boolean {
  return (ch >= 65 && ch <= 90) ||     // A-Z
         (ch >= 97 && ch <= 122) ||    // a-z
         ch === 95;                    // _
}

function isIdentifierPart(ch: number): boolean {
  return isIdentifierStart(ch) || isDigit(ch);
}

function isLetter(ch: number): boolean {
  return isUppercase(ch) || isLowercase(ch);
}

function isUppercase(ch: number): boolean {
  return ch >= 65 && ch <= 90;   // A-Z
}

function isLowercase(ch: number): boolean {
  return ch >= 97 && ch <= 122;  // a-z
}
