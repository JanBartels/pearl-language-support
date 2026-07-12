// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import {
    Token,
    TokenKind,
    CommentToken,
    CommentKind,
    createToken,
    createCommentToken
} from './';

import { Span } from '../core/span';
import { Location } from '../core/location';

import { Source } from "../source/source";

import { ProblemCollection } from '../core/problemCollection';

import { Logger } from '../utility/logging/logger';

const DUMP_TOKENS = false;

class CharStream {

  private pos = 0;

  constructor(private readonly source: Source) {
  }

  getSource(): Source {
    return this.source;
  }

  getText(span?: Span): string {
    return this.source.getText(span);
  }

  get uri(): string {
    return this.source.uri;
  }

  get offset(): number {
    return this.pos;
  }

  eof(): boolean {
    return this.pos >= this.source.length;
  }

  peek(offset = 0): number {
    const index = this.pos + offset;
    if (index >= this.source.length) return -1;
    return this.source.text.charCodeAt(index);
  }

  next(): number {
    if (this.pos >= this.source.length) return -1;
    return this.source.text.charCodeAt(this.pos++);
  }

  advance(count = 1): void {
    this.pos = Math.min(this.pos + count, this.source.length);
  }

  mark(): number {
    return this.pos;
  }

  reset(position: number): void {
    this.pos = position;
  }
}

export class Lexer {

  private readonly stream: CharStream;

  constructor(
    source: Source,
    private readonly problems: ProblemCollection,
    private readonly logger: Logger
  ) {
    this.stream = new CharStream(source);
  }

  // Achtung: Reihenfolge wichtig: Nach Länge sortieren!
  private static readonly OPERATORS = [
    // DATION-Richtung im SYSTEM-Teil
    "<->",
    "<-",
    "->",

    // Operatoren und sonstige Sonderzeichen
    "//",
    "**",
    "==",
    "/=",
    "<=",
    ">=",
    "<>",
    "><",

    "[",
    "]",
    "(",
    ")",
    ",",
    ".",
    ";",
    ":",
    "+",
    "-",
    "*",
    "/",
    "=",
    "<",
    ">"
  ] as const;

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

    if (DUMP_TOKENS) {

      this.logger.debug?.(`Lexer produced ${tokens.length} tokens`);

      for (let i = 0; i < Math.min(tokens.length, 20); i++) {

        const token = tokens[i]!;
        const text = this.tokenText(token);

        this.logger.debug?.(`Lexer [${i}] ${TokenKind[token.kind]} "${text}" @${token.location.span.start}`);
      }
    }

    return tokens;
  }

  private tokenText(token: Token): string {
    return this.stream.getText(token.location.span);
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

    if (ch === 47 /* / */ && this.stream.peek(1) === 42 /* * */) {
      return this.lexBlockComment();
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
    if (isDigit(ch) ||
        (ch === 46 /* . */ && isDigit(this.stream.peek(1)))) {
        return this.lexNumber();
    }

    // String / Bit literal
    if (ch === 39 /* ' */) {
      return this.lexStringOrBitLiteral();
    }

    // Hex literal ($...)
    if (ch === 36 /* $ */) {
        return this.lexHexLiteral();
    }

    // Fallback: operator / punctuation
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

    return this.createCommentTokenFromSpan( CommentKind.Line, start );
  }

  private lexBlockComment(): Token {

    const start = this.stream.mark();

    this.stream.next(); // /
    this.stream.next(); // *

    let terminated = false;

    while (true) {

      const ch = this.stream.peek();

      if (ch === -1) {
        break;              // TODO: unterminated comment
      }

      if (ch === 42 /* * */) {

        this.stream.next();

        if (this.stream.peek() === 47 /* / */) {
          this.stream.next();
          terminated = true;
          break;
        }

        continue;
      }

      this.stream.next();
    }

    if (!terminated) {
      this.problems.error(this.location(start),"Unterminated block comment.");
    }

    return this.createCommentTokenFromSpan( CommentKind.Block, start );
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

      let hasDigitsBeforeDot = false;
      let hasDot = false;
      let hasDigitsAfterDot = false;
      let hasExponent = false;

      // ------------------------------------------------------------
      // Ganzzahlteil
      // ------------------------------------------------------------

      while (isDigit(this.stream.peek())) {
          hasDigitsBeforeDot = true;
          this.stream.next();
      }

      // ------------------------------------------------------------
      // Nachkommateil
      // ------------------------------------------------------------

      if (this.stream.peek() === 46 /* . */) {

          hasDot = true;
          this.stream.next();

          while (isDigit(this.stream.peek())) {
              hasDigitsAfterDot = true;
              this.stream.next();
          }
      }

      // ------------------------------------------------------------
      // Exponent
      // ------------------------------------------------------------

      if (this.stream.peek() === 69 /* E */) {

          hasExponent = true;

          const exponentStart = this.stream.mark();

          this.stream.next();

          if (this.stream.peek() === 43 /* + */ ||
              this.stream.peek() === 45 /* - */) {

              this.stream.next();
          }

          if (!isDigit(this.stream.peek())) {

              this.problems.error(
                  this.location(exponentStart),
                  "Expected exponent."
              );

          } else {

              while (isDigit(this.stream.peek())) {
                  this.stream.next();
              }
          }
      }

      // ------------------------------------------------------------
      // Mindestens vor oder nach dem Punkt müssen Ziffern stehen.
      // ------------------------------------------------------------

      if (!hasDigitsBeforeDot && !hasDigitsAfterDot) {

          this.problems.error(
              this.location(start),
              "Invalid number literal."
          );
      }

      // ------------------------------------------------------------
      // HexDigitSequence?
      // Nur möglich, wenn kein '.' und kein Exponent vorkam.
      // ------------------------------------------------------------

      if (!hasDot && !hasExponent) {

          let containsHexLetter = false;

          while (true) {

              const ch = this.stream.peek();

              if (ch >= 65 /* A */ && ch <= 70 /* F */) {
                  containsHexLetter = true;
                  this.stream.next();
                  continue;
              }

              break;
          }

          if (containsHexLetter) {

              if (isIdentifierStart(this.stream.peek())) {

                  this.problems.error(
                      this.location(start),
                      "Invalid hexadecimal digit sequence."
                  );

                  while (isIdentifierPart(this.stream.peek())) {
                      this.stream.next();
                  }
              }

              return this.createTokenFromSpan(
                  TokenKind.HexDigitSequence,
                  start
              );
          }
      }

      // ------------------------------------------------------------
      // Ungültiges NumberLiteral?
      // ------------------------------------------------------------

      if (isIdentifierStart(this.stream.peek())) {

          this.problems.error(
              this.location(start),
              "Invalid number literal."
          );

          while (isIdentifierPart(this.stream.peek())) {
              this.stream.next();
          }
      }

      return this.createTokenFromSpan(
          TokenKind.NumberLiteral,
          start
      );
  }

  private lexHexLiteral(): Token {

      const start = this.stream.mark();

      this.stream.next(); // consume '$'

      let hasDigits = false;

      while (true) {

          const ch = this.stream.peek();

          if (isHexDigit(ch)) {
              hasDigits = true;
              this.stream.next();
              continue;
          }

          break;
      }

      if (!hasDigits) {
          this.problems.error(
              this.location(start),
              "Expected hexadecimal literal."
          );
      }

      if (isIdentifierStart(this.stream.peek()) ||
          isDigit(this.stream.peek())) {

          this.problems.error(
              this.location(start),
              "Invalid hexadecimal literal."
          );

          this.consumeMalformedIdentifierSuffix();
      }

      return this.createTokenFromSpan(
          TokenKind.HexLiteral,
          start
      );
  }

  private lexStringOrBitLiteral(): Token {

      const start = this.stream.mark();

      this.stream.next(); // opening '

      let terminated = false;

      while (true) {

          const ch = this.stream.peek();

          if (ch === -1) {
              break; // unterminated string (EOF)
          }

          if (ch === 10 || ch === 13) {
            break; // unterminated string (end of line)
          }

          if (ch === 39 /* ' */) {

              this.stream.next(); // consume '

              const next = this.stream.peek();

              // Escaped apostrophe: ''
              if (next === 39 /* ' */) {
                  this.stream.next();      // consume second '
                  continue;
              }

              // Control sequence: '\
              if (next === 92 /* \ */) {

                  this.stream.next();      // consume opening '\

                  // Scan until closing \'
                  while (true) {

                      const c = this.stream.peek();

                      if (c === -1) {
                          break;          // unterminated control sequence
                      }

                      this.stream.next();

                      if (c === 92 /* \ */ &&
                          this.stream.peek() === 39 /* ' */) {

                          this.stream.next(); // consume closing '
                          break;
                      }
                  }

                  continue;
              }

              // Normal end of string
              terminated = true;
              break;
          }

          this.stream.next();
      }

      if (!terminated) {
        this.problems.error(this.location(start), "Unterminated string literal.");
      }

      const afterQuote = this.stream.peek();

      // Bit literal suffix: B or B1–B4 (no whitespace allowed)
      if (afterQuote === 66 /* B */) {

          this.stream.next(); // consume B

          const next = this.stream.peek();

          if (next >= 49 && next <= 52) {
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

      // Präprozessor-" gesondert behandeln
      if (this.stream.peek() === 34 /* " */) {
          this.stream.next();
          return this.createTokenFromSpan(
              TokenKind.PreprocessorOperator,
              start
          );
      }

      for (const op of Lexer.OPERATORS) {

          let matches = true;

          for (let i = 0; i < op.length; i++) {
              if (this.stream.peek(i) !== op.charCodeAt(i)) {
                  matches = false;
                  break;
              }
          }

          if (!matches) {
              continue;
          }

          for (let i = 0; i < op.length; i++) {
              this.stream.next();
          }

          return this.createTokenFromSpan(
              TokenKind.Operator,
              start
          );
      }

      // Unbekanntes Zeichen
      this.stream.next();

      this.problems.error(
          this.location(start),
          `Unexpected character '${this.stream.getText({ start, end: start + 1 })}'.`
      );

      return this.createTokenFromSpan(
          TokenKind.Operator,
          start
      );
     
  }
  // -----------------------------
  // Token creation helpers
  // -----------------------------

  private location(start: number, end = this.stream.offset): Location {
    const span: Span = {
      start,
      end
    };

    const location: Location = {
      source: this.stream.getSource(),
      span
    };

    return location;
  }

  private createZeroLengthToken(kind: TokenKind): Token {
    return createToken(kind, this.location(this.stream.offset, this.stream.offset));
  }

  private createTokenFromSpan(kind: TokenKind, start: number): Token {
    return createToken(kind, this.location(start));
  }

  private createCommentTokenFromSpan(
      commentKind: CommentKind,
      start: number
  ): CommentToken {

      return createCommentToken(
          this.location(start),
          commentKind
      );
  }

  private consumeMalformedIdentifierSuffix(): void {

      while (isIdentifierPart(this.stream.peek())) {
          this.stream.next();
      }
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

function isHexDigit(ch: number): boolean {
    return isDigit(ch)
        || (ch >= 65 && ch <= 70)   // A-F
        || (ch >= 97 && ch <= 102); // a-f
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
