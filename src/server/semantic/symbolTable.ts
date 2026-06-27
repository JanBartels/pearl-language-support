// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Symbol } from './symbol';

export class SymbolTable {

    private readonly symbols =
        new Map<string, Symbol>();

    define(symbol: Symbol): boolean {
        return false;
    }

    lookup(name: string): Symbol | undefined {
        return undefined;
    }

    clear(): void {
    }
}
