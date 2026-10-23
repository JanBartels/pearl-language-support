// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { SourceValue } from '../core/sourceValue';
import type { SemanticContext } from './semanticContext';
import { SymbolKind } from './symbolKind';
import type { SymbolReferenceResolutionIndex } from './symbolReferenceResolutionIndex';

/** All physical names denoting one declaration within a translation unit.
 * A local SPC/PROC pair may have two declaration sites, but a GLOBAL SPC
 * without a same-module definition has only its own local site.
 */
export interface SymbolOccurrences {
    readonly declaration: SourceValue<string>;
    readonly declarations: readonly SourceValue<string>[];
    readonly references: readonly SourceValue<string>[];
}

/**
 * Compiler information for navigation and future rename support.
 * Symbol identity is the semantic *definition SourceValue*, not the spelling
 * or an editor location. No project-wide linking is attempted: RTOS-UH's
 * loader handles the connections between GLOBAL modules.
 */
export class SymbolOccurrenceIndex {
    readonly all: readonly SymbolOccurrences[];
    private readonly byIdentifier: ReadonlyMap<SourceValue<string>, SymbolOccurrences>;

    constructor(resolutions: SymbolReferenceResolutionIndex, semantic: SemanticContext) {
        type MutableOccurrences = {
            declaration: SourceValue<string>;
            declarations: Set<SourceValue<string>>;
            references: Set<SourceValue<string>>;
        };
        const groups = new Map<SourceValue<string>, MutableOccurrences>();
        const identifierTargets = new Map<SourceValue<string>, SourceValue<string>>();

        const groupFor = (declaration: SourceValue<string>): MutableOccurrences => {
            let group = groups.get(declaration);
            if (!group) {
                group = { declaration, declarations: new Set(), references: new Set() };
                groups.set(declaration, group);
            }
            return group;
        };

        // Reuse the resolver's decisions. Unresolved, deferred and built-in
        // occurrences have no concrete declaration in this translation unit.
        for (const result of resolutions.all) {
            if (result.kind !== 'bound') continue;
            const identifier = result.reference.identifier;
            groupFor(result.declaration).references.add(identifier);
            identifierTargets.set(identifier, result.declaration);
        }

        for (const [identifier, symbol] of semantic.bindings) {
            // A type placeholder created during REF recovery is not a
            // declaration. Do not make its name navigable by accident.
            if (symbol.kind === SymbolKind.Type && !symbol.definition) continue;

            const declaration = symbol.definition ?? symbol.name;
            const relation = semantic.localSpecificationRelations.get(identifier);
            const isDeclaration = identifier === symbol.name
                || identifier === symbol.definition
                || relation?.specification === identifier
                || relation?.definition === identifier;
            if (!isDeclaration) continue;

            const group = groupFor(declaration);
            group.declarations.add(identifier);
            if (symbol.name.location) group.declarations.add(symbol.name);
            if (symbol.definition?.location) group.declarations.add(symbol.definition);
            identifierTargets.set(identifier, declaration);
            if (symbol.name.location) identifierTargets.set(symbol.name, declaration);
            if (symbol.definition?.location) identifierTargets.set(symbol.definition, declaration);
        }

        // Normally every bound reference has a corresponding declaration in
        // the same TU. Keep an available definition even after error recovery.
        for (const group of groups.values()) {
            if (group.declaration.location) group.declarations.add(group.declaration);
        }

        const finalized = new Map<SourceValue<string>, SymbolOccurrences>();
        for (const [key, group] of groups) {
            finalized.set(key, Object.freeze({
                declaration: group.declaration,
                declarations: Object.freeze([...group.declarations]),
                references: Object.freeze([...group.references])
            }));
        }
        this.all = Object.freeze([...finalized.values()]);
        this.byIdentifier = new Map(
            [...identifierTargets].flatMap(([identifier, target]): [SourceValue<string>, SymbolOccurrences][] => {
                const group = finalized.get(target);
                return group ? [[identifier, group]] : [];
            })
        );
    }

    lookup(identifier: SourceValue<unknown>): SymbolOccurrences | undefined {
        return typeof identifier.value === 'string'
            ? this.byIdentifier.get(identifier as SourceValue<string>)
            : undefined;
    }
}
