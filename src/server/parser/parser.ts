// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { TokenStream } from '../lexer/tokenStream';
import { Token, TokenKind } from '../lexer/token';
import { ProblemCollection } from '../core/problemCollection';
import { Location } from '../core/location';

import { AstNode } from '../ast/astNode';
import { TranslationUnitNode } from '../ast/translationUnitNode';

import { Logger } from '../utility/logging/logger';

const DUMP_TOKENS = true;

export class Parser {

    constructor(
        private readonly stream: TokenStream,
        private readonly problems: ProblemCollection,
        private readonly logger: Logger
    ) {}

    parse(): AstNode {

        const unit = new TranslationUnitNode(this.current().location);

        while (!this.eof()) {

            if (DUMP_TOKENS) {

                const token = this.current();
                const text = this.tokenText(token);

                this.logger.debug?.(`Parser ${TokenKind[token.kind]} "${text}" @${token.location.span.start}`);
            }

          this.stream.next();
        }

        return unit;
    }

    /*
    ** Hilfsmethoden für den TokenStream
    */

    private current(): Token {
        return this.stream.current();
    }

    private next(): void {
        this.stream.next();
    }

    private eof(): boolean {
        return this.stream.eof();
    }

    private tokenText(token = this.current()): string {
        return this.stream.tokenText(token);
    }

    private location(token = this.current()): Location {
        return token.location;
    }

    private tokenKind(token = this.current()): TokenKind {
        return token.kind;
    }

    /*
    ** Hilfsmethoden zum Parsen
    */

    private isKeyword(
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

    private acceptKeyword(
        keywords: string | readonly string[]
    ): boolean {

        if (!this.isKeyword(keywords)) {
            return false;
        }

        this.next();
        return true;
    }

    private expectKeyword(
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

        this.problems.error(
            this.location(token),
            `Expected ${expected}.`
        );

        return false;
    }

    private isOperator(
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

    private acceptOperator(
        operators: string | readonly string[]
    ): boolean {

        if (!this.isOperator(operators)) {
            return false;
        }

        this.next();
        return true;
    }

    private expectOperator(
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

        this.problems.error(
            this.location(token),
            `Expected ${expected}.`
        );

        return false;
    }

    private isIdentifier(
        token: Token = this.current()
    ): boolean {

        return this.tokenKind(token) === TokenKind.Identifier;
    }

    private acceptIdentifier(): Token | undefined {

        const token = this.current();

        if (!this.isIdentifier(token)) {
            return undefined;
        }

        this.next();

        return token;
    }

    private expectIdentifier(): Token | undefined {

        const token = this.current();

        if (this.isIdentifier(token)) {
            this.next();
            return token;
        }

        this.problems.error(
            this.location(token),
            "Expected identifier."
        );

        return undefined;
    }

    private isNumberLiteral(
        token: Token = this.current()
    ): boolean {

        return this.tokenKind(token) === TokenKind.NumberLiteral;
    }

    private acceptNumberLiteral(): Token | undefined {

        const token = this.current();

        if (!this.isNumberLiteral(token)) {
            return undefined;
        }

        this.next();
        return token;
    }

    private expectNumberLiteral(): Token | undefined {

        const token = this.current();

        if (this.isNumberLiteral(token)) {
            this.next();
            return token;
        }

        this.problems.error(
            this.location(token),
            "Expected number literal."
        );

        return undefined;
    }    

    private isStringLiteral(
        token: Token = this.current()
    ): boolean {

        return this.tokenKind(token) === TokenKind.StringLiteral;
    }

    private acceptStringLiteral(): Token | undefined {

        const token = this.current();

        if (!this.isStringLiteral(token)) {
            return undefined;
        }

        this.next();
        return token;
    }

    private expectStringLiteral(): Token | undefined {

        const token = this.current();

        if (this.isStringLiteral(token)) {
            this.next();
            return token;
        }

        this.problems.error(
            this.location(token),
            "Expected string literal."
        );

        return undefined;
    }

    private isBitLiteral(
        token: Token = this.current()
    ): boolean {

        return this.tokenKind(token) === TokenKind.BitLiteral;
    }

    private acceptBitLiteral(): Token | undefined {

        const token = this.current();

        if (!this.isBitLiteral(token)) {
            return undefined;
        }

        this.next();

        return token;
    }

    private expectBitLiteral(): Token | undefined {

        const token = this.current();

        if (this.isBitLiteral(token)) {
            this.next();
            return token;
        }

        this.problems.error(
            this.location(token),
            "Expected bit literal."
        );

        return undefined;
    }
}
