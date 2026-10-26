// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { Location } from '../core/location';
import { containsSourceOffset, mapToOriginalLocation, type SourceOffset } from '../core/sourceOffset';
import type { MacroDefinition } from './macroDefinition';
import type { MacroReference } from './macroReference';

/** A particular macro definition and all its usages, including those in includes. */
export interface MacroOccurrences {
    readonly definition: MacroDefinition;
    readonly references: readonly MacroReference[];
}

export interface MacroOccurrenceMatch {
    readonly group: MacroOccurrences;
    readonly location: Location;
    readonly isDefinition: boolean;
}

/** Returned when the same visible position cannot be attributed unambiguously. */
export const AMBIGUOUS_MACRO_OCCURRENCE = 'ambiguous' as const;
export type MacroOccurrenceLookup = MacroOccurrenceMatch | typeof AMBIGUOUS_MACRO_OCCURRENCE | undefined;

/**
 * Persistent preprocessor information. Its lookup uses physical URI + offset,
 * independently of the AST and independently of LSP document availability.
 */
export class MacroOccurrenceIndex {
    readonly all: readonly MacroOccurrences[];

    constructor(
        definitions: readonly MacroDefinition[],
        references: readonly MacroReference[]
    ) {
        const groups = new Map<MacroDefinition, MacroReference[]>();
        for (const definition of definitions) {
            if (!groups.has(definition)) groups.set(definition, []);
        }
        for (const reference of references) {
            let uses = groups.get(reference.definition);
            if (!uses) {
                uses = [];
                groups.set(reference.definition, uses);
            }
            uses.push(reference);
        }
        this.all = Object.freeze([...groups].map(([definition, uses]) => Object.freeze({
            definition,
            references: Object.freeze([...uses])
        })));
    }

    /**
     * Prefer a physically written token over an occurrence introduced through
     * expansion, which may map onto that same editor position.
     * Definitions and references use precisely the same selection rules.
     */
    lookupAt(position: SourceOffset): MacroOccurrenceLookup {
        const direct: MacroOccurrenceMatch[] = [];
        const expanded: MacroOccurrenceMatch[] = [];

        const add = (group: MacroOccurrences, location: Location | undefined, isDefinition: boolean) => {
            if (!location || !containsSourceOffset(location, position)) return;
            const original = mapToOriginalLocation(location);
            const match: MacroOccurrenceMatch = { group, location, isDefinition };
            if (original.source === location.source) direct.push(match);
            else expanded.push(match);
        };

        for (const group of this.all) {
            add(group, group.definition.directiveLocation, true);
            add(group, group.definition.location, true);
            for (const reference of group.references) {
                add(group, reference.location, false);
            }
        }

        const matches = direct.length ? direct : expanded;
        if (!matches.length) return undefined;

        // Multiple occurrences of one definition at a physical macro invocation
        // are harmless. Different definitions at the same cursor are ambiguous.
        const first = matches[0]!;
        if (matches.some(match => match.group !== first.group)) {
            return AMBIGUOUS_MACRO_OCCURRENCE;
        }
        return first;
    }
}
