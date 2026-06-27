// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Location } from '../core/location';
import { AstNode } from './astNode';
import { AstKind } from './astKind';

export class TranslationUnitNode extends AstNode {

    readonly children: AstNode[] = [];

    constructor(location: Location) {
        super(AstKind.TranslationUnit, location);
    }

    addChild(node: AstNode): void {
        this.children.push(this.adopt(node));
    }    
}
