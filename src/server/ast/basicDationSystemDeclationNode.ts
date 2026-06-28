// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from './astKind';
import { Location } from '../core';
import { SystemDeclarationNode } from './systemDeclarationNode';

export class BasicDationSystemDeclarationNode extends SystemDeclarationNode {

    constructor(
        location: Location,
        name: string,
        public readonly address: string,
        public readonly accessCode: number | undefined,
        public readonly direction: string
    ) {
        super(
            AstKind.BasicDationSystemDeclaration,
            location,
            name
        );
    }

    public override dumpLabel(): string {
       return `BASIC Dation(${this.name} direction ${this.direction})`;
    }

}
