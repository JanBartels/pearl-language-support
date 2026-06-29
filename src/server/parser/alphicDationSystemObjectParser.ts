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

        if (!this.expectSemicolon()) {
            this.synchronize([';']);
        }

        return new AlphicDationSystemDeclarationNode(
            location,
            name,
            systemName,
            direction ?? '<->',
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

        if (!this.acceptLeftParenthesis()) {
            return { tfu, ne, mb, ai };
        }

        if (this.acceptKeyword('TFU')) {
            tfu = this.parseIntegerParameter('TFU', 1, 32767);
            this.acceptComma();
        }

        if (this.acceptKeyword('NE')) {
            ne = true;
            this.acceptComma();
        }

        if (this.acceptKeyword('MB')) {
            mb = this.parseHexParameter('MB', 2);
            this.acceptComma();
        }

        if (this.acceptKeyword('AI')) {
            ai = this.parseHexParameter('AI', 4);
        }

        if (this.isIdentifier()) {

            this.problems.error(
                this.location(),
                `Unknown parameter '${this.tokenText()}'.`
            );

            this.synchronize([')']);
        }

        this.expectRightParenthesis();

        return {
            tfu,
            ne,
            mb,
            ai
        };
    }

    private parseIntegerParameter(
        name: string,
        minimum: number,
        maximum: number
    ): number | undefined {

        if (!this.expectEquals()) {
            this.synchronizeParameter();
            return undefined;
        }

        const literal = this.expectNumberLiteral(
            `Expected integer value for ${name}.`
        );
        if (!literal) {
            this.synchronizeParameter();
            return undefined;
        }

        const value = Number(this.tokenText(literal));
        if (!this.validateIntegerLiteral(
            value,
            minimum,
            maximum,
            name,
            literal.location
        )) {

            return undefined;
        }

        return value;
    }

    private parseHexParameter(
        name: string,
        digits: number
    ): string | undefined {

        if (!this.expectEquals()) {
            this.synchronizeParameter();
            return undefined;
        }

        const literal = this.expectHexLiteral(
            `Expected ${digits}-digit hexadecimal number as ${name}.`
        );
        if (!literal) {
            this.synchronizeParameter();
            return undefined;
        }

        const value = this.tokenText(literal);
        if (!this.validateHexLiteralLength(
            value,
            digits,
            name,
            literal.location
        )) {
            return undefined;
        }

        return value;
    }

    private synchronizeParameter(): void {
        this.synchronize([
            ')',
            ',',
            ';',
            '->',
            '<-',
            '<->'
        ]);
    }    
}
