// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

// -----------------------------------------------------------------------------
// InterruptDeclaration
//
// InterruptDeclaration =
//     "EV" "(" HexNumber ")" ";" ;
// -----------------------------------------------------------------------------

import { SourceValue } from '../core/sourceValue';
import { InterruptSystemDeclarationNode } from '../ast/interruptSystemDeclarationNode';
import { TailParser } from './tailParser';

export class InterruptSystemObjectParser extends TailParser {

    parseTail(
        name: SourceValue<string>
    ): InterruptSystemDeclarationNode | undefined {

        const evKeyword = this.acceptKeyword('EV');
        if (!evKeyword) {
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
                "event mask"
            );
        }

        this.expectRightParenthesis();

        this.expectSemicolon();

        return new InterruptSystemDeclarationNode(
            this.tokenValue( evKeyword ),
            name,
            mask ?? SourceValue.synthetic("00000000")
        );
    }

    private synchronizeInterruptDeclaration(): void {

        this.synchronize([
            ')',
            ';'
        ]);
    }
}
