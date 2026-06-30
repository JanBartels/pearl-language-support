// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from './astKind';
import { Location } from '../core';
import { SourceValue } from '../core/sourceValue';
import { SystemDeclarationNode } from './systemDeclarationNode';

export class AlphicDationSystemDeclarationNode extends SystemDeclarationNode {

    constructor(
        location: Location,
        name: SourceValue<string>,
        public readonly systemName: SourceValue<string>,
        public readonly direction: SourceValue<string>,
        public readonly tfu: SourceValue<string> | undefined,
        public readonly neFlag: SourceValue<boolean>,
        public readonly mb: SourceValue<string> | undefined,
        public readonly ai: SourceValue<string> | undefined
    ) {
        super(
            AstKind.AlphicDationSystemDeclaration,
            location,
            name
        );
    }

    public override dumpLabel(): string {
        return `ALPHIC Dation(${this.name.value} systemName ${this.systemName.value} direction ${this.direction.value})`;
    }
}

