// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from './astKind';
import { Location } from '../core';
import { SourceValue } from '../core/sourceValue';
import { SystemDeclarationNode } from './systemDeclarationNode';

export class BasicDationSystemDeclarationNode extends SystemDeclarationNode {

    constructor(
        location: Location,
        name: SourceValue<string>,
        public readonly address: SourceValue<string>,
        public readonly accessCode: SourceValue<string> | undefined,
        public readonly direction: SourceValue<string>,
    ) {
        super(
            AstKind.BasicDationSystemDeclaration,
            location,
            name
        );
    }

    public override dumpLabel(): string {
       return `BASIC Dation(${this.name.value} direction ${this.direction.value})`;
    }

}
