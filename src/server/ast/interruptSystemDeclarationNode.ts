// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from './astKind';
import { Location } from '../core';
import { SourceValue } from '../core/sourceValue';
import { SystemDeclarationNode } from './systemDeclarationNode';

export class InterruptSystemDeclarationNode extends SystemDeclarationNode {

    constructor(location: Location, name: SourceValue<string>, public readonly mask: SourceValue<string>) {
        super(
            AstKind.InterruptSystemDeclaration,
            location,
            name
        );
    }
    
    public override dumpLabel(): string {
       return `Interrupt(${this.name.value} mask ${this.mask.value} )`;
    }

}
