// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

// -----------------------------------------------------------------------------
// DationDeclaration
//
// DationDeclaration =
//     DationSpecification Direction ";" ;
// -----------------------------------------------------------------------------

import { Location } from '../core';
import { TailParser } from './tailParser';
import { Token } from '../lexer/token';
import { BasicDationSystemDeclarationNode } from '../ast/basicDationSystemDeclationNode';

export class BasicDationSystemObjectParser extends TailParser {

    parseTail(
        location: Location,
        name: string
    ): BasicDationSystemDeclarationNode | undefined {

        if (!this.acceptKeyword('BU')) {
            return undefined;
        }

        this.expectLeftParenthesis();

        const address = this.parseHexNumber();
        if (!address) {
            this.synchronizeBUDeclaration();
        }

        let access: Token | undefined;

        if (this.acceptComma()) {

            access = this.expectNumberLiteral();
            if (!access) {
                this.synchronizeBUDeclaration();
            } else {

                const value = Number(this.tokenText(access));

                this.validateIntegerLiteral(
                    value,
                    0,
                    8,
                    "BU access code",
                    access.location
                );
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
            location,
            name,
            address ? address : '',
            access ? Number(this.tokenText(access)) : undefined,
            direction ?? '->' // Default nur Dummy für AST-Vervollständigung im Fehlerfall
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