// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { Environment } from './environment';
import type { Scope } from './scope';
import type { TypeSymbol } from './symbol';


export class TypeIndex {

    private readonly typesByScope =
        new Map<Scope, Map<string, TypeSymbol>>();


    index(scope: Scope, symbol: TypeSymbol): TypeSymbol | undefined {

        let types = this.typesByScope.get(scope);

        if (!types) {
            types = new Map<string, TypeSymbol>();
            this.typesByScope.set(scope, types);
        }

        const existing = types.get(symbol.name.value);

        if (existing) {
            return existing;
        }

        types.set(symbol.name.value, symbol);

        return undefined;
    }


    lookupInScope(scope: Scope, name: string): TypeSymbol | undefined {

        return this.typesByScope.get(scope)?.get(name);
    }


    lookupForwardType(name: string, environment: Environment): TypeSymbol | undefined {

        let scope: Scope | undefined = environment.scope;

        while (scope) {

            const symbol = this.lookupInScope(scope, name);

            if (symbol) {
                return symbol;
            }

            scope = scope.parent;
        }

        return undefined;
    }
}
