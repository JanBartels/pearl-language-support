// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { SourceValue } from '../core/sourceValue';
import type { SymbolReferenceResolution } from './symbolReferenceResolution';

/**
 * Semantic results for the occurrences collected in one translation unit.
 * Identity is based on the original SourceValue, never the mapped editor
 * location: macro expansions can produce distinct compiler occurrences that
 * map to one physical invocation site.
 */
export class SymbolReferenceResolutionIndex {
    readonly all: readonly SymbolReferenceResolution[];
    private readonly byIdentifier: ReadonlyMap<SourceValue<string>, SymbolReferenceResolution>;
    private readonly byDeclaration: ReadonlyMap<SourceValue<string>, readonly SymbolReferenceResolution[]>;

    constructor(resolutions: readonly SymbolReferenceResolution[] = []) {
        this.all = Object.freeze([...resolutions]);
        const byIdentifier = new Map<SourceValue<string>, SymbolReferenceResolution>();
        const byDeclaration = new Map<SourceValue<string>, SymbolReferenceResolution[]>();

        for (const resolution of this.all) {
            const identifier = resolution.reference.identifier;
            if (byIdentifier.has(identifier)) {
                throw new Error('A SourceValue cannot have multiple reference resolutions.');
            }
            byIdentifier.set(identifier, resolution);

            if (resolution.kind === 'bound') {
                const references = byDeclaration.get(resolution.declaration) ?? [];
                references.push(resolution);
                byDeclaration.set(resolution.declaration, references);
            }
        }

        this.byIdentifier = byIdentifier;
        this.byDeclaration = new Map(
            [...byDeclaration].map(([declaration, uses]) => [declaration, Object.freeze(uses)])
        );
    }

    lookup(identifier: SourceValue<unknown>): SymbolReferenceResolution | undefined {
        return typeof identifier.value === 'string'
            ? this.byIdentifier.get(identifier as SourceValue<string>)
            : undefined;
    }

    /** Semantic usages bound to precisely this declaration (not including the declaration itself). */
    referencesOf(declaration: SourceValue<string>): readonly SymbolReferenceResolution[] {
        return this.byDeclaration.get(declaration) ?? [];
    }
}
