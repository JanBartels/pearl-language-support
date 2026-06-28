// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

// -----------------------------------------------------------------------------
// DationDeclaration
//
// DationDeclaration =
//     DationSpecification Direction ";" ;
// -----------------------------------------------------------------------------

import { Location } from '../core';
import { extendSpan } from '../core/span';
import { TokenKind } from '../lexer/token';
import { TailParser } from './tailParser';
import { AlphicDationSystemDeclarationNode } from '../ast/alphicDationSystemDeclationNode';

export class AlphicDationSystemObjectParser extends TailParser {

    parseTail(
        location: Location,
        name: string
    ): AlphicDationSystemDeclarationNode | undefined {

        // ------------------------------------------------------------
        // Systemname (A1, XYZ, ...)
        // ------------------------------------------------------------

        const systemName = this.parseSystemName();
        if (!systemName) {
            return undefined;
        }


        // ------------------------------------------------------------
        // (TFU=int,NE,MB=$hexno,AI=$hexno)
        // ------------------------------------------------------------
        const parameters = this.parseParameterList();

        // ------------------------------------------------------------
        // Richtung
        //   ->
        //   <-
        //   <->
        // ------------------------------------------------------------

        const direction = this.parseDirection();
        if (!direction) {
            // Recovery folgt später.
        }

        this.skipTrivia();
        this.expectOperator(';');

        return new AlphicDationSystemDeclarationNode(
            location,
            name,
            systemName,
            direction!,
            parameters.tfu,
            parameters.ne,
            parameters.mb,
            parameters.ai
        );
    }

    private parseSystemName(): string | undefined {

        if (this.isOperator([
            '(',
            ';',
            '->',
            '<-',
            '<->'
        ])) {
            this.context.problems.error(
                this.location(),
                'Expected system name.'
            );
            return undefined;
        }

        const first = this.current();

        let last = first;

        while (!this.eof()) {

            if (this.isOperator([
                '(',
                ';',
                '->',
                '<-',
                '<->'
            ])) {
                break;
            }

            const token = this.current();

            if (token !== first && !this.isAdjacent(last, token)) {
                this.context.problems.error(
                    token.location,
                    'Whitespace is not allowed in system names.'
                );
                break;
            }

            last = token;
            this.next();
        }

        return this.text(
            extendSpan(first.location.span, last.location.span)
        );
    }

    private parseParameterList(): {
        tfu: number | undefined;
        ne: boolean;
        mb: string | undefined;
        ai: string | undefined;
    } {

        let tfu: number | undefined;
        let ne = false;
        let mb: string | undefined;
        let ai: string | undefined;

        this.skipTrivia();

        if (!this.acceptOperator('(')) {
            return { tfu, ne, mb, ai };
        }

        this.skipTrivia();

        // ------------------------------------------------------------
        // TFU
        // ------------------------------------------------------------

        if (this.acceptKeyword('TFU')) {

            this.skipTrivia();
            this.expectOperator('=');

            this.skipTrivia();
            const number = this.expectNumberLiteral();
            if (number) {
                tfu = Number(this.tokenText(number));
            }

            this.skipTrivia();
            if (this.acceptOperator(',')) {
                this.skipTrivia();
            }
        }

        // ------------------------------------------------------------
        // NE
        // ------------------------------------------------------------

        if (this.acceptKeyword('NE')) {

            ne = true;

            this.skipTrivia();
            if (this.acceptOperator(',')) {
                this.skipTrivia();
            }
        }

        // ------------------------------------------------------------
        // MB
        // ------------------------------------------------------------

        if (this.acceptKeyword('MB')) {

            this.skipTrivia();
            this.expectOperator('=');

            this.skipTrivia();
            const literal = this.expectHexLiteral();
            if (literal) {
                mb = this.tokenText(literal);
            }

            this.skipTrivia();
            if (this.acceptOperator(',')) {
                this.skipTrivia();
            }
        }

        // ------------------------------------------------------------
        // AI
        // ------------------------------------------------------------

        if (this.acceptKeyword('AI')) {

            this.skipTrivia();
            this.expectOperator('=');

            this.skipTrivia();
            const literal = this.expectHexLiteral();
            if (literal) {
                ai = this.tokenText(literal);
            }

            this.skipTrivia();
        }

        this.expectOperator(')');

        return {
            tfu,
            ne,
            mb,
            ai
        };
    }
}
