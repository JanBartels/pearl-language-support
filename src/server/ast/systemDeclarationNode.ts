// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from './astKind';
import { AstNode } from './astNode';
import { Location } from '../core';

export abstract class SystemDeclarationNode extends AstNode {

    protected constructor(
        kind: AstKind,
        location: Location,
        public readonly name: string
    ) {
        super(kind, location);
    }
}
