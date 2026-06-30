// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Location } from '../core/location';
import { SourceValue } from '../core/sourceValue';
import { AstNode } from './astNode';
import { AstKind } from './astKind';

import { SystemPartNode } from './systemPartNode';
import { ProblemPartNode } from './problemPartNode';

export class ModuleNode extends AstNode {

    readonly name: SourceValue<string>;

    systemPart?: SystemPartNode;

    problemPart?: ProblemPartNode;

    constructor(
        location: Location,
        name: SourceValue<string>
    ) {
        super(AstKind.Module, location);

        this.name = name;
    }

    public override dumpLabel(): string {
       return `Module(${this.name.value})`;
    }

    public override getChildren(): readonly AstNode[] {
        const result: AstNode[] = [];

        if (this.systemPart) {
            result.push(this.systemPart);
        }

        if (this.problemPart) {
            result.push(this.problemPart);
        }

        return result;
    }
}
