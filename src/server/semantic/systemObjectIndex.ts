// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { SourceValue } from '../core/sourceValue';
import type { Scope } from './scope';
import type { SemanticType } from './semanticType';

export interface SystemObjectDeclaration {
    readonly name: SourceValue<string>;
    readonly type: SemanticType;
}

export class SystemObjectIndex {
    private readonly objectsByScope = new Map<Scope, Map<string, SystemObjectDeclaration>>();

    index(scope: Scope, declaration: SystemObjectDeclaration): SystemObjectDeclaration | undefined {
        let objects = this.objectsByScope.get(scope);

        if (!objects) {
            objects = new Map<string, SystemObjectDeclaration>();
            this.objectsByScope.set(scope, objects);
        }

        const existing = objects.get(declaration.name.value);
        if (existing) {
            return existing;
        }

        objects.set(declaration.name.value, declaration);
        return undefined;
    }

    lookupInScope(scope: Scope, name: string): SystemObjectDeclaration | undefined {
        return this.objectsByScope.get(scope)?.get(name);
    }
}
