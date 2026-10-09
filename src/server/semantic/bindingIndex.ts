// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { SourceValue } from '../core/sourceValue';
import type { SemanticSymbol } from './symbol';

export type BindingIndex = ReadonlyMap<SourceValue<string>, SemanticSymbol>;

export function lookupBoundSymbol(
    bindings: BindingIndex,
    source: SourceValue<unknown>
): SemanticSymbol | undefined {
    if (typeof source.value !== 'string') {
        return undefined;
    }

    return bindings.get(source as SourceValue<string>);
}

export function lookupSymbolDefinition(
    bindings: BindingIndex,
    source: SourceValue<unknown>
): SourceValue<string> | undefined {
    const symbol = lookupBoundSymbol(bindings, source);
    return symbol?.definition;
}
