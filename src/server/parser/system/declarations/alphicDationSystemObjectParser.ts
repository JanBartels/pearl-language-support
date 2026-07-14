// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

// -----------------------------------------------------------------------------
// DationDeclaration
//
// DationDeclaration =
//     DationSpecification Direction ";" ;
// -----------------------------------------------------------------------------

import { SourceValue } from '../../../core/sourceValue';
import { extendSpan } from '../../../core/span';
import { TailParser } from '../../tailParser';
import { AlphicDationSystemDeclarationNode } from '../../../ast/system/declarations/alphicDationSystemDeclationNode';

export class AlphicDationSystemObjectParser extends TailParser {

    parseTail(
        name: SourceValue<string>
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
            name,
            systemName,
            direction ?? SourceValue.synthetic('<->'),
            parameters.tfu,
            parameters.ne,
            parameters.mb,
            parameters.ai
        );
    }

    private parseSystemName(): SourceValue<string> | undefined {

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

        const span = extendSpan(
            first.location.span,
            last.location.span
        );

        return this.spanValue(span);
    }

    private parseParameterList(): {
        tfu: SourceValue<string> | undefined;
        ne: SourceValue<boolean>;
        mb: SourceValue<string> | undefined;
        ai: SourceValue<string> | undefined;
    } {

        let tfu: SourceValue<string> | undefined;
        let ne = new SourceValue(false);
        let mb: SourceValue<string> | undefined;
        let ai: SourceValue<string> | undefined;

        if (!this.acceptLeftParenthesis()) {
            return { tfu, ne, mb, ai };
        }

        if (this.acceptKeyword('TFU')) {
            tfu = this.parseIntegerParameter('TFU', 1, 32767);
            this.acceptComma();
        }

        const neToken = this.current();
        if (this.acceptKeyword('NE')) {
            ne = new SourceValue(true, neToken.location);
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
    ): SourceValue<string> | undefined {

        if (!this.expectEquals()) {
            this.synchronizeParameter();
            return undefined;
        }

        const token = this.expectNumberLiteral(
            `Expected integer value for ${name}.`
        );
        if (!token) {
            this.synchronizeParameter();
            return undefined;
        }

        const literal = this.tokenValue(token);

        if (!this.validateIntegerLiteral(
            literal,
            minimum,
            maximum,
            name
        )) {
            return undefined;
        }

        return literal;
    }

    private parseHexParameter(
        name: string,
        digits: number
    ): SourceValue<string> | undefined {

        if (!this.expectEquals()) {
            this.synchronizeParameter();
            return undefined;
        }

        const token = this.expectHexLiteral(
            `Expected ${digits}-digit hexadecimal number as ${name}.`
        );
        if (!token) {
            this.synchronizeParameter();
            return undefined;
        }

        const literal = this.tokenValue(token);

        if (!this.validateHexLiteralLength(
            literal,
            digits,
            name
        )) {
            return undefined;
        }

        return literal;
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
