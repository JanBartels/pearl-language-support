// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../core/sourceValue';
import { SourceHighlightAttribute, SourceHighlightKind, type SourceHighlight } from './sourceHighlight';
import type { MacroOccurrenceIndex } from '../preproc/macroOccurrenceIndex';
import type { Location } from '../core/location';

/**
 * Highlights physical occurrences from the existing preprocessor index.
 *
 * The index groups occurrences by *definition identity*, not merely name:
 * redefinitions, #undef and conditional uses therefore remain distinct.
 * No macro lookup or expansion is repeated here.
 *
 * A reference in expanded text may map to a differently spelled invocation.
 * Supplying lexicalLocation lets SourceHighlightMapper reject such synthetic
 * ranges unless the physical document actually contains this macro name.
 */
export class MacroHighlightCollector {
    collect(occurrences: MacroOccurrenceIndex): readonly SourceHighlight[] {
        const highlights: SourceHighlight[] = [];

        const append = (name: string, location: Location | undefined, declaration: boolean): void => {
            if (!location) return; // e.g. a predefined macro from user settings
            highlights.push({
                element: new SourceValue(name, location, location),
                kind: SourceHighlightKind.Macro,
                ...(declaration ? {attributes: [SourceHighlightAttribute.Declaration]} : {})
            });
        };

        for (const group of occurrences.all) {
            append(group.definition.name, group.definition.location, true);
            // #undef is a navigable macro occurrence even though it is not a
            // use of the replacement (and does not prevent an unused warning).
            for (const reference of group.references) {
                append(group.definition.name, reference.location, false);
            }
        }
        return highlights;
    }
}
