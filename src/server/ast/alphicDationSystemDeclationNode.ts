// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from './astKind';
import { Location } from '../core';
import { SystemDeclarationNode } from './systemDeclarationNode';

export class AlphicDationSystemDeclarationNode extends SystemDeclarationNode {

    constructor(
        location: Location, 
        name: string, 
        public readonly systemName: string, 
        public readonly direction: string,
        public readonly tfu: number | undefined,
        public readonly neFlag: boolean,
        public readonly mb: string | undefined,
        public readonly ai: string | undefined        
    ) {
        super(
            AstKind.AlphicDationSystemDeclaration,
            location,
            name
        );
    }

    public override dumpLabel(): string {
       return `ALPHIC Dation(${this.name} systemName ${this.systemName} direction ${this.direction})`;
    }

}
