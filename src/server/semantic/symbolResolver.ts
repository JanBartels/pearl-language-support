// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { Environment } from './environment';
import type { SemanticSymbol } from './symbol';

export function resolveSymbol(
    environment: Environment | undefined,
    name: string
): SemanticSymbol | undefined {

    let current = environment;

    while (current !== undefined) {

        for (const symbol of current.introducedSymbols) {

            if (symbol.name.value === name) {
                return symbol;
            }
        }

        if (current.previous !== undefined) {
            current = current.previous;
            continue;
        }

        current = current.outer;
    }

    return undefined;
}
