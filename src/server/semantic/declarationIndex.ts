// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { SourceValue } from '../core/sourceValue';
import type { Scope } from './scope';
import { SymbolKind } from './symbolKind';

export interface IndexedDeclaration {
    readonly kind: SymbolKind;
    readonly name: SourceValue<string>;
}

export class DeclarationIndex {
    private readonly declarationsByScope = new Map<Scope, Map<string, IndexedDeclaration>>();

    index(scope: Scope, declaration: IndexedDeclaration): IndexedDeclaration | undefined {
        let declarations = this.declarationsByScope.get(scope);

        if (!declarations) {
            declarations = new Map<string, IndexedDeclaration>();
            this.declarationsByScope.set(scope, declarations);
        }

        const existing = declarations.get(declaration.name.value);

        if (existing) {
            return existing;
        }

        declarations.set(declaration.name.value, declaration);
        return undefined;
    }

    lookupInScope(scope: Scope, name: string): IndexedDeclaration | undefined {
        return this.declarationsByScope.get(scope)?.get(name);
    }
}
