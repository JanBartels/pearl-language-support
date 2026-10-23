// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { SourceValue } from '../core/sourceValue';
import type { SymbolReference } from './symbolReference';

/**
 * Index of syntactically collected name usages in one translation unit.
 *
 * SourceValue identity is used intentionally. Distinct occurrences in a
 * macro expansion must not be merged merely because mapLocation() maps
 * them to the same invocation in the physical source file.
 *
 * This index does not contain declarations or bindings. The semantic
 * binding index remains independent until the resolution phase (7.2).
 */
export class SymbolReferenceIndex {
    private readonly references: readonly SymbolReference[];
    private readonly byIdentifier: ReadonlyMap<SourceValue<string>, SymbolReference>;

    constructor(references: readonly SymbolReference[] = []) {
        this.references = Object.freeze([...references]);
        const byIdentifier = new Map<SourceValue<string>, SymbolReference>();

        for (const reference of this.references) {
            if (byIdentifier.has(reference.identifier)) {
                throw new Error('A SourceValue must not be collected as two symbol references.');
            }
            byIdentifier.set(reference.identifier, reference);
        }

        this.byIdentifier = byIdentifier;
    }

    get all(): readonly SymbolReference[] {
        return this.references;
    }

    lookup(identifier: SourceValue<unknown>): SymbolReference | undefined {
        if (typeof identifier.value !== 'string') {
            return undefined;
        }
        return this.byIdentifier.get(identifier as SourceValue<string>);
    }
}
