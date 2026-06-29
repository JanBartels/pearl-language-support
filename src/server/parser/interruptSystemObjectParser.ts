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

        this.expectLeftParenthesis();

        const mask = this.parseHexNumber();
        if (!mask) {
            this.synchronizeInterruptDeclaration();
        } else {
            this.validateHexDigitSequenceLength(
                mask,
                8,
                "event mask",
                this.location()
            );
        }        

        this.expectRightParenthesis();

        this.expectSemicolon();

        return new InterruptSystemDeclarationNode(
            location,
            name,
            mask ?? '00000000'
        );
    }

    private synchronizeInterruptDeclaration(): void {

        this.synchronize([
            ')',
            ';'
        ]);
    }    
}