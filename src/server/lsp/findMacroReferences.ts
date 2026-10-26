// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { Location as LspLocation, Position } from 'vscode-languageserver';
import { AMBIGUOUS_MACRO_OCCURRENCE, type MacroOccurrenceIndex } from '../preproc/macroOccurrenceIndex';
import type { DocumentRegistry } from '../utility/documentRegistry';
import { mapLspLocation } from './lspLocationMapper';

/**
 * undefined: cursor is not on a macro; []: selected macro has no requested
 * occurrences (or the cursor is ambiguous). No fallback to text matching.
 */
export function findMacroReferences(
    index: MacroOccurrenceIndex,
    uri: string,
    position: Position,
    includeDeclaration: boolean,
    registry: DocumentRegistry
): LspLocation[] | undefined {
    const document = registry.get(uri);
    if (!document) return undefined;

    const occurrence = index.lookupAt({ uri, offset: document.offsetAt(position) });
    if (occurrence === undefined) return undefined;
    if (occurrence === AMBIGUOUS_MACRO_OCCURRENCE) return [];

    const group = occurrence.group;
    const locations = includeDeclaration
        ? [group.definition.location, ...group.references.map(ref => ref.location)]
        : group.references.map(ref => ref.location);

    const seen = new Set<string>();
    const results: LspLocation[] = [];
    for (const location of locations) {
        if (!location) continue;
        const mapped = mapLspLocation(location, registry);
        if (!mapped) continue;
        const { start, end } = mapped.range;
        const key = `${mapped.uri}:${start.line}:${start.character}:${end.line}:${end.character}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push(mapped);
    }
    return results.sort((left, right) =>
        left.uri.localeCompare(right.uri)
        || comparePositions(left.range.start, right.range.start)
        || comparePositions(left.range.end, right.range.end));
}

function comparePositions(left: Position, right: Position): number {
    return left.line - right.line || left.character - right.character;
}
