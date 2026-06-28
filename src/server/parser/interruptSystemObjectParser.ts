// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

// -----------------------------------------------------------------------------
// InterruptDeclaration
//
// InterruptDeclaration =
//     "EV" "(" HexNumber ")" ";" ;
// -----------------------------------------------------------------------------

import { Location } from '../core';
import { InterruptSystemDeclarationNode } from '../ast/interruptSystemDeclarationNode';
import { TailParser } from './tailParser';

export class InterruptSystemObjectParser extends TailParser {

    parseTail(
        location: Location,
        name: string
    ): InterruptSystemDeclarationNode | undefined {

        if (!this.acceptKeyword('EV')) {
            return undefined;
        }

        this.skipTrivia();
        this.expectOperator('(');

        this.skipTrivia();
        const maskToken = this.parseHexNumber();
        const mask = maskToken
            ? maskToken
            : '00000000';

        this.skipTrivia();
        this.expectOperator(')');

        this.skipTrivia();
        this.expectOperator(';');

        return new InterruptSystemDeclarationNode(
            location,
            name,
            mask
        );
    }
}