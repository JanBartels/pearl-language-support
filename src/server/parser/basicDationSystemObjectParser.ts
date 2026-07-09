// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

// -----------------------------------------------------------------------------
// DationDeclaration
//
// DationDeclaration =
//     DationSpecification Direction ";" ;
// -----------------------------------------------------------------------------

import { SourceValue } from '../core/sourceValue';
import { TailParser } from './tailParser';
import { BasicDationSystemDeclarationNode } from '../ast/basicDationSystemDeclarationNode';

export class BasicDationSystemObjectParser extends TailParser {

    parseTail(
        name: SourceValue<string>
    ): BasicDationSystemDeclarationNode | undefined {

        const buKeyword = this.acceptKeyword('BU');
        if (!buKeyword) {
            return undefined;
        }

        this.expectLeftParenthesis();

        const address = this.parseHexNumber();
        if (!address) {
            this.synchronizeBUDeclaration();
        }

        let accessCode: SourceValue<string> | undefined;

        if (this.acceptComma()) {

            const token = this.expectNumberLiteral();

            if (!token) {
                this.synchronizeBUDeclaration();
            } else {

                const literal = new SourceValue(
                    this.tokenText(token),
                    token.location
                );

                if (this.validateIntegerLiteral(
                    literal,
                    0,
                    8,
                    "BU access code"
                )) {
                    accessCode = literal;
                }
            }
        }

        this.expectRightParenthesis();

        const direction = this.parseDirection();

        if (!direction) {
            this.problems.error(
                this.location(),
                "Expected transfer direction."
            );
            this.synchronizeBUDeclaration();
        }

        this.expectSemicolon();

        return new BasicDationSystemDeclarationNode(
            this.tokenValue( buKeyword ),
            name,
            address ?? SourceValue.synthetic(""),
            accessCode,
            direction ?? SourceValue.synthetic("->")
        );
    }

    private synchronizeBUDeclaration(): void {

        this.synchronize([
            ')',
            '->',
            '<-',
            '<->',
            ';'
        ]);
    }
}
