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

        this.skipTrivia();
        this.expectOperator('(');

        const address = this.parseHexNumber();

        let access: Token | undefined;

        this.skipTrivia();
        if (this.acceptOperator(',')) {
            this.skipTrivia();
            access = this.expectNumberLiteral();
        }

        this.skipTrivia();
        this.expectOperator(')');

        const direction = this.parseDirection();

        this.skipTrivia();
        this.expectOperator(';');

        return new BasicDationSystemDeclarationNode(
            location,
            name,
            address ? address : '',
            access ? Number(this.tokenText(access)) : undefined,
            direction
        );
    }
}