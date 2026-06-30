// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Token, TokenKind } from '../lexer/token';
import { Span } from '../core/span';
import { Location } from '../core/location';
import { SourceValue } from '../core/sourceValue';

import { AstNode } from '../ast/astNode';

import { ParserContext } from './parserContext';
import { ProblemCollection } from '../core/problemCollection';

const RESERVED_WORDS = new Set<string>([
  'ACTIVATE',
  'AFTER',
  'ALL',
  'ALPHIC',
  'ALT',
  'AT',
  'BASIC',
  'BEGIN',
  'BY',
  'CALL',
  'CASE',
  'CLOSE',
  'CONT',
  'CONTINUE',
  'CONTROL',
  'CONVERT',
  'CREATE',
  'CREATED',
  'CYCLIC',
  'DECLARE',
  'DCL',
  'DELETE',
  'DIM',
  'DIRECT',
  'DISABLE',
  'ELSE',
  'ENABLE',
  'END',
  'ENTER',
  'ENTRY',
  'EVERY',
  'EXIT',
  'FIN',
  'FOR',
  'FORBACK',
  'FORMAT',
  'FORWARD',
  'FREE',
  'FROM',
  'GET',
  'GLOBAL',
  'GOTO',
  'HRS',
  'IDENTICAL',
  'IDENT',
  'IDF',
  'IF',
  'IN',
  'INDUCE',
  'INIT',
  'INITIAL',
  'INLINE',
  'INOUT',
  'INTFAC',
  'INV',
  'LEAVE',
  'LENGTH',
  'MATCH',
  'MAX',
  'MIN',
  'MODEND',
  'MODULE',
  'NIL',
  'NOCYCL',
  'NOMATCH',
  'NOSTREAM',
  'ON',
  'ONEOF',
  'OPEN',
  'OPERATOR',
  'OUT',
  'PRECEDENCE',
  'PRESET',
  'PREVENT',
  'PRIORITY',
  'PRIO',
  'PROBLEM',
  'PROCEDURE',
  'PROC',
  'PUT',
  'READ',
  'REENT',
  'REF',
  'RELEASE',
  'REPEAT',
  'REQUEST',
  'RESERVE',
  'RESIDENT',
  'RESUME',
  'RETURN',
  'RETURNS',
  'SEC',
  'SEMASET',
  'SEND',
  'SHELLMODULE',
  'SIGNAL',
  'SPECIFY',
  'SPC',
  'STREAM',
  'STRUCT',
  'SUSPEND',
  'SYS',
  'SYSTEM',
  'TAKE',
  'TASK',
  'TERMINATE',
  'TFU',
  'THEN',
  'TO',
  'TRIGGER',
  'TRY',
  'TYPE',
  'UNTIL',
  'UPON',
  'USING',
  'WHEN',
  'WHILE',
  'WRITE'
]);

export abstract class ParserBase {

    constructor(
        protected readonly context: ParserContext
    ) {}

    abstract parse(): AstNode | undefined;

    protected get problems(): ProblemCollection {
        return this.context.problems;
    }

    /*
    ** Hilfsmethoden für den TokenStream
    */

    protected current(): Token {
        return this.context.stream.current();
    }

    protected next(): void {
        this.context.stream.next();
    }

    protected eof(): boolean {
        return this.context.stream.eof();
    }

    protected tokenText(token = this.current()): string {
        return this.context.stream.tokenText(token);
    }

    protected text(span: Span): string {
       return this.context.stream.getText(span);
    }

    protected location(token = this.current()): Location {
        return token.location;
    }

    protected tokenKind(token = this.current()): TokenKind {
        return token.kind;
    }

    /*
    ** Hilfsmethoden zum Parsen
    */

    protected sourceValue<T>(
        value: T,
        location?: Location
    ): SourceValue<T> {

        return new SourceValue(value, location);
    }

    protected tokenValue(
        token: Token
    ): SourceValue<string> {

        return new SourceValue(
            this.tokenText(token),
            this.location(token)
        );
    }

    protected spanValue(
        span: Span
    ): SourceValue<string> {

        return this.sourceValue(
            this.text(span),
            {
                source: this.location().source,
                span
            }
        );
    }    

    protected isAdjacent(
        left: Token,
        right: Token
    ): boolean {

        if (left.location.source !== right.location.source) {
            return false;
        }

        return left.location.span.end === right.location.span.start;
    }

    protected skipTrivia(): void {

        while (!this.eof()) {

            switch (this.tokenKind()) {

                case TokenKind.Newline:
                case TokenKind.Comment:
                    this.next();
                    continue;
            }

            break;
        }
    }

    protected isReservedWord(token?: Token): boolean {

        const text = this.tokenText(token);

        return RESERVED_WORDS.has(text);
    }

    protected isKeyword(
        keywords: string | readonly string[],
        token: Token = this.current()
    ): boolean {

        if (this.tokenKind(token) !== TokenKind.Identifier) {
            return false;
        }

        const list = Array.isArray(keywords)
            ? keywords
            : [keywords];

        return list.includes(this.tokenText(token));
    }

    protected acceptKeyword(
        keywords: string | readonly string[]
    ): boolean {

        if (!this.isKeyword(keywords)) {
            return false;
        }

        this.next();
        return true;
    }

    protected expectKeyword(
        keywords: string | readonly string[],
        message?: string
    ): boolean {

        const token = this.current();

        if (this.acceptKeyword(keywords)) {
            return true;
        }

        const list = Array.isArray(keywords)
            ? keywords
            : [keywords];

        const expected =
            list.length === 1
                ? `'${list[0]}'`
                : `one of ${list.map(k => `'${k}'`).join(", ")}`;

        this.context.problems.error(
            this.location(token),
            message ?? `Expected ${expected}.`
        );

        return false;
    }

    protected isOperator(
        operators: string | readonly string[],
        token: Token = this.current()
    ): boolean {

        if (this.tokenKind(token) !== TokenKind.Operator) {
            return false;
        }

        const list = Array.isArray(operators)
            ? operators
            : [operators];

        return list.includes(this.tokenText(token));
    }

    protected acceptOperator(
        operators: string | readonly string[]
    ): boolean {

        if (!this.isOperator(operators)) {
            return false;
        }

        this.next();
        return true;
    }

    protected expectOperator(
        operators: string | readonly string[],
        message?: string
    ): boolean {

        const token = this.current();

        if (this.acceptOperator(operators)) {
            return true;
        }

        const list = Array.isArray(operators)
            ? operators
            : [operators];

        const expected =
            list.length === 1
                ? `'${list[0]}'`
                : `one of ${list.map(op => `'${op}'`).join(", ")}`;

        this.context.problems.error(
            this.location(token),
            message ?? `Expected ${expected}.`
        );

        return false;
    }

    protected isIdentifier(
        token: Token = this.current()
    ): boolean {

        return token.kind === TokenKind.Identifier
            && !this.isReservedWord(token);
    }

    protected acceptIdentifier(): Token | undefined {

        const token = this.current();

        if (!this.isIdentifier(token)) {
            return undefined;
        }

        this.next();

        return token;
    }

    protected expectIdentifier(message?: string): Token | undefined {

        const token = this.current();

        if (this.isIdentifier(token)) {
            this.next();
            return token;
        }

        this.context.problems.error(
            this.location(token),
            message ?? "Expected identifier."
        );

        return undefined;
    }

    protected isNumberLiteral(
        token: Token = this.current()
    ): boolean {

        return this.tokenKind(token) === TokenKind.NumberLiteral;
    }

    protected acceptNumberLiteral(): Token | undefined {

        const token = this.current();

        if (!this.isNumberLiteral(token)) {
            return undefined;
        }

        this.next();
        return token;
    }

    protected expectNumberLiteral(message?: string): Token | undefined {

        const token = this.current();

        if (this.isNumberLiteral(token)) {
            this.next();
            return token;
        }

        this.context.problems.error(
            this.location(token),
            message ?? "Expected number literal."
        );

        return undefined;
    }    

    protected validateIntegerLiteral(
        literal: SourceValue<string> | undefined,
        minimum: number,
        maximum: number,
        name: string
    ): boolean {

        if (!literal) {
            return false;
        }

        const value = Number(literal.value);

        if (!Number.isInteger(value)) {
            this.problems.error(
                literal.location!,
                `${name} must be an integer.`
            );
            return false;
        }

        if (value < minimum || value > maximum) {
            this.problems.error(
                literal.location!,
                `${name} must be in the range ${minimum}..${maximum}.`
            );
            return false;
        }

        return true;
    }

    protected isHexLiteral(
        token: Token = this.current()
    ): boolean {

        return this.tokenKind(token) === TokenKind.HexLiteral;
    }

    protected acceptHexLiteral(): Token | undefined {

        const token = this.current();

        if (!this.isHexLiteral(token)) {
            return undefined;
        }

        this.next();

        return token;
    }

    protected expectHexLiteral(message?: string): Token | undefined {

        const token = this.current();

        if (this.isHexLiteral(token)) {
            this.next();
            return token;
        }

        this.context.problems.error(
            this.location(token),
            message ?? 'Expected hexadecimal literal.'
        );

        return undefined;
    }

    protected validateHexLiteralLength(
        literal: SourceValue<string> | undefined,
        digits: number,
        name: string
    ): boolean {

        if (!literal) {
            return false;
        }

        if (literal.value.length !== digits + 1) {
            this.problems.error(
                literal.location!,
                `${name} requires exactly ${digits} hexadecimal digits.`
            );
            return false;
        }

        return true;
    }

    protected isHexDigitSequence(
        token: Token = this.current()
    ): boolean {

        return this.tokenKind(token) === TokenKind.HexDigitSequence;
    }

    /**
     * Akzeptiert eine Folge von Hexziffern ohne '$'-Präfix.
     *
     * Dieses Token ist kein reguläres PEARL-Literal, sondern wird ausschließlich
     * für die historischen Hexzahlen in BU(...) und EV(...) verwendet.
     */
    protected acceptHexDigitSequence(): Token | undefined {

        const token = this.current();

        if (!this.isHexDigitSequence(token)) {
            return undefined;
        }

        this.next();

        return token;
    }

    /**
     * Erwartet eine Folge von Hexziffern ohne '$'-Präfix.
     *
     * Dieses Token ist kein reguläres PEARL-Literal, sondern wird ausschließlich
     * für die historischen Hexzahlen in BU(...) und EV(...) verwendet.
     */
    protected expectHexDigitSequence(
        message?: string
    ): Token | undefined {

        const token = this.current();

        if (this.isHexDigitSequence(token)) {
            this.next();
            return token;
        }

        this.context.problems.error(
            this.location(token),
            message ?? 'Expected hexadecimal digit sequence.'
        );

        return undefined;
    }

    protected validateHexDigitSequenceLength(
        literal: SourceValue<string> | undefined,
        digits: number,
        name: string
    ): boolean {

        if (!literal) {
            return false;
        }

        if (literal.value.length !== digits) {
            this.problems.error(
                literal.location!,
                `${name} must consist of ${digits} hexadecimal digits.`
            );
            return false;
        }

        return true;
    }

    protected isStringLiteral(
        token: Token = this.current()
    ): boolean {

        return this.tokenKind(token) === TokenKind.StringLiteral;
    }

    protected acceptStringLiteral(): Token | undefined {

        const token = this.current();

        if (!this.isStringLiteral(token)) {
            return undefined;
        }

        this.next();
        return token;
    }

    protected expectStringLiteral(message?: string): Token | undefined {

        const token = this.current();

        if (this.isStringLiteral(token)) {
            this.next();
            return token;
        }

        this.context.problems.error(
            this.location(token),
            message ?? "Expected string literal."
        );

        return undefined;
    }

    protected isBitLiteral(
        token: Token = this.current()
    ): boolean {

        return this.tokenKind(token) === TokenKind.BitLiteral;
    }

    protected acceptBitLiteral(): Token | undefined {

        const token = this.current();

        if (!this.isBitLiteral(token)) {
            return undefined;
        }

        this.next();

        return token;
    }

    protected expectBitLiteral(message?: string): Token | undefined {

        const token = this.current();

        if (this.isBitLiteral(token)) {
            this.next();
            return token;
        }

        this.context.problems.error(
            this.location(token),
            message ?? "Expected bit literal."
        );

        return undefined;
    }

    /*
    ** Hilfsparser
    */

    protected acceptComma(): boolean {

        this.skipTrivia();

        const accepted = this.acceptOperator(',');

        this.skipTrivia();

        return accepted;
    }

    protected expectComma(
        message?: string
    ): boolean {

        this.skipTrivia();

        const ok = this.expectOperator(
            ',',
            message
        ) !== undefined;

        this.skipTrivia();

        return ok;
    }

    protected acceptSemicolon(): boolean {

        this.skipTrivia();

        const accepted = this.acceptOperator(';');

        this.skipTrivia();

        return accepted;
    }

    protected expectSemicolon(
        message?: string
    ): boolean {

        this.skipTrivia();

        const ok = this.expectOperator(
            ';',
            message
        ) !== undefined;

        this.skipTrivia();

        return ok;
    }

    protected acceptColon(): boolean {

        this.skipTrivia();

        const accepted = this.acceptOperator(':');

        this.skipTrivia();

        return accepted;
    }

    protected expectColon(
        message?: string
    ): boolean {

        this.skipTrivia();

        const ok = this.expectOperator(
            ':',
            message
        ) !== undefined;

        this.skipTrivia();

        return ok;
    }

    protected acceptEquals(): boolean {

        this.skipTrivia();

        const accepted = this.acceptOperator('=');

        this.skipTrivia();

        return accepted;
    }

    protected expectEquals(
        message?: string
    ): boolean {

        this.skipTrivia();

        const ok = this.expectOperator(
            '=',
            message
        ) !== undefined;

        this.skipTrivia();

        return ok;
    }

    protected acceptLeftParenthesis(): boolean {

        this.skipTrivia();

        const accepted = this.acceptOperator('(');

        this.skipTrivia();

        return accepted;
    }

    protected expectLeftParenthesis(
        message?: string
    ): boolean {

        this.skipTrivia();

        const ok = this.expectOperator(
            '(',
            message
        ) !== undefined;

        this.skipTrivia();

        return ok;
    }

    protected acceptRightParenthesis(): boolean {

        this.skipTrivia();

        const accepted = this.acceptOperator(')');

        this.skipTrivia();

        return accepted;
    }

    protected expectRightParenthesis(
        message?: string
    ): boolean {

        this.skipTrivia();

        const ok = this.expectOperator(
            ')',
            message
        ) !== undefined;

        this.skipTrivia();

        return ok;
    }

    protected acceptLeftBracket(): boolean {

        this.skipTrivia();

        const accepted = this.acceptOperator('[');

        this.skipTrivia();

        return accepted;
    }

    protected expectLeftBracket(
        message?: string
    ): boolean {

        this.skipTrivia();

        const ok = this.expectOperator(
            '[',
            message
        ) !== undefined;

        this.skipTrivia();

        return ok;
    }

    protected acceptRightBracket(): boolean {

        this.skipTrivia();

        const accepted = this.acceptOperator(']');

        this.skipTrivia();

        return accepted;
    }

    protected expectRightBracket(
        message?: string
    ): boolean {

        this.skipTrivia();

        const ok = this.expectOperator(
            ']',
            message
        ) !== undefined;

        this.skipTrivia();

        return ok;
    }

    /**
     * Liest eine Hexzahl für BU(...) und EV(...).
     *
     * PEARL erlaubt an diesen Stellen Hexzahlen ohne '$'-Präfix.
     * Daher werden sowohl NumberLiteral (nur Ziffern) als auch
     * HexDigitSequence (enthält A...F) akzeptiert.
     */
    protected parseHexNumber(
        message?: string
    ): SourceValue<string> | undefined {

        const number = this.acceptNumberLiteral();
        if (number) {
            return this.tokenValue(number);
        }

        const hex = this.acceptHexDigitSequence();
        if (hex) {
            return this.tokenValue(hex);
        }

        this.context.problems.error(
            this.location(),
            message ?? 'Expected hexadecimal number.'
        );

        return undefined;
    }

    protected parseDirection(): SourceValue<string> | undefined {

        this.skipTrivia();

        const token = this.current();

        if (this.acceptOperator('->')) {
            return this.tokenValue(token);
        }

        if (this.acceptOperator('<-')) {
            return this.tokenValue(token);
        }

        if (this.acceptOperator('<->')) {
            return this.tokenValue(token);
        }

        return undefined;
    }

    /*
    ** Hilfsmethoden für Recovery
    */

    protected synchronize(tokens: readonly string[]): void {

        while (!this.eof()) {

            if (this.isOperator(tokens) ||
                this.isKeyword(tokens)) {
                return;
            }

            this.next();
        }
    }
}
