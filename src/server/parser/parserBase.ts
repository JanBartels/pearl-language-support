// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Token, TokenKind } from '../lexer/token';
import { Location } from '../core/location';

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

    protected location(token = this.current()): Location {
        return token.location;
    }

    protected tokenKind(token = this.current()): TokenKind {
        return token.kind;
    }

    /*
    ** Hilfsmethoden zum Parsen
    */

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
        keywords: string | readonly string[]
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
            `Expected ${expected}.`
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
        operators: string | readonly string[]
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
            `Expected ${expected}.`
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

    protected expectIdentifier(): Token | undefined {

        const token = this.current();

        if (this.isIdentifier(token)) {
            this.next();
            return token;
        }

        this.context.problems.error(
            this.location(token),
            "Expected identifier."
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

    protected expectNumberLiteral(): Token | undefined {

        const token = this.current();

        if (this.isNumberLiteral(token)) {
            this.next();
            return token;
        }

        this.context.problems.error(
            this.location(token),
            "Expected number literal."
        );

        return undefined;
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

    protected expectStringLiteral(): Token | undefined {

        const token = this.current();

        if (this.isStringLiteral(token)) {
            this.next();
            return token;
        }

        this.context.problems.error(
            this.location(token),
            "Expected string literal."
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

    protected expectBitLiteral(): Token | undefined {

        const token = this.current();

        if (this.isBitLiteral(token)) {
            this.next();
            return token;
        }

        this.context.problems.error(
            this.location(token),
            "Expected bit literal."
        );

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
