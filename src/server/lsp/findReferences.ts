// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { Location as LspLocation, Position } from 'vscode-languageserver';
import type { SourceValue } from '../core/sourceValue';
import type { SymbolOccurrences } from '../semantic/symbolOccurrenceIndex';
import type { Analysis } from '../validation/analysis';
import type { DocumentRegistry } from '../utility/documentRegistry';
import { mapLspLocation } from './lspLocationMapper';

/**
 * Converts compiler symbol occurrences to the original physical documents.
 * This layer does not resolve names or scopes and never scans source text.
 */
export function findReferences(
    analysis: Analysis,
    uri: string,
    position: Position,
    includeDeclaration: boolean,
    registry: DocumentRegistry
): LspLocation[] {
    const index = analysis.symbolOccurrences;
    const candidates: SymbolOccurrences[] = [];

    // Match an editor position using URI and range. The AST has a source-aware
    // lookup too; the occurrence index preserves semantic identity here.
    for (const group of index.all) {
        const occurrences = [...group.declarations, ...group.references];
        if (occurrences.some(value => atCursor(value, uri, position, registry))) {
            candidates.push(group);
        }
    }

    // Distinct macro expansions can map to the same invocation range.
    // Never guess a target if that physical position is ambiguous.
    if (candidates.length !== 1) return [];

    const group = candidates[0];
    const results: LspLocation[] = [];
    const seen = new Set<string>();
    const values = includeDeclaration
        ? [...group.declarations, ...group.references]
        : group.references;

    for (const value of values) {
        const location = value.location && mapLspLocation(value.location, registry);
        if (!location) continue;
        const key = `${location.uri}:${location.range.start.line}:${location.range.start.character}:` +
            `${location.range.end.line}:${location.range.end.character}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push(location);
    }

    return results.sort(compareLocations);
}

function atCursor(
    source: SourceValue<string>,
    uri: string,
    position: Position,
    registry: DocumentRegistry
): boolean {
    const location = source.location && mapLspLocation(source.location, registry);
    return !!location && location.uri === uri &&
        comparePositions(location.range.start, position) <= 0 &&
        comparePositions(position, location.range.end) < 0;
}

function comparePositions(left: Position, right: Position): number {
    return left.line - right.line || left.character - right.character;
}

function compareLocations(left: LspLocation, right: LspLocation): number {
    return left.uri.localeCompare(right.uri)
        || comparePositions(left.range.start, right.range.start)
        || comparePositions(left.range.end, right.range.end);
}
