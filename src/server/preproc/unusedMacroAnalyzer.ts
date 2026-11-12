// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { MacroDefinition } from './macroDefinition';
import type { MacroOccurrenceIndex } from './macroOccurrenceIndex';

/**
 * Determine unused source #defines from the preprocessor's actual bindings.
 *
 * A redefinition creates a distinct definition identity. References to the
 * value or existence of a macro count as uses, but #undef only removes the
 * definition. Predefined macros have no source location and are not reported.
 *
 * A physical #define in a repeatedly included file may have several runtime
 * definition identities. It is unused only if none of those instances is used,
 * and receives at most one diagnostic in its original source file.
 */
export class UnusedMacroAnalyzer {
    analyze(occurrences: MacroOccurrenceIndex): readonly MacroDefinition[] {
        const byLocation = new Map<string, { definition: MacroDefinition; used: boolean }>();

        for (const group of occurrences.all) {
            const location = group.definition.location;
            if (!location) continue;
            const key = `${location.source.uri}:${location.span.start}:${location.span.end}`;
            const used = group.references.some(reference => reference.kind !== 'undef');
            const existing = byLocation.get(key);
            if (existing) {
                existing.used ||= used;
            } else {
                byLocation.set(key, { definition: group.definition, used });
            }
        }

        return [...byLocation.values()]
            .filter(entry => !entry.used)
            .map(entry => entry.definition)
            .sort((a, b) => {
                const left = a.location!;
                const right = b.location!;
                return left.source.uri.localeCompare(right.source.uri)
                    || left.span.start - right.span.start;
            });
    }
}
