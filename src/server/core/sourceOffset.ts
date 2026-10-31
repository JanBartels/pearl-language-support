// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { Location } from './location';
import { contains } from './span';

/** A position in a physical editor document, not an offset in an expansion. */
export interface SourceOffset {
    readonly uri: string;
    readonly offset: number;
}

/** Explicitly map a compiler location through its full Source chain. */
export function mapToOriginalLocation(location: Location): Location {
    let current = location;
    const visited = new Set<object>();

    while (!visited.has(current.source)) {
        visited.add(current.source);
        const mapped = current.source.mapLocation(current);
        if (mapped.source === current.source
            && mapped.span.start === current.span.start
            && mapped.span.end === current.span.end) {
            break;
        }
        current = mapped;
    }

    return current;
}

/**
 * Return all contributing original source regions for a compiler location.
 *
 * A token assembled from macro expansions, includes or separated source slices
 * may have multiple origins. In contrast, mapToOriginalLocation() deliberately
 * returns only its primary anchor, preserving existing LSP behavior.
 *
 * Results follow expanded-text order; a macro invocation can occur more than
 * once when separate output fragments refer to that same invocation. No extra
 * source range is invented to bridge discontiguous fragments.
 */
export function mapToOriginalLocations(location: Location): readonly Location[] {
    const origins: Location[] = [];

    function visit(current: Location, path: Set<object>): void {
        if (path.has(current.source)) {
            // Defensive stop for malformed cyclic Source mappings.
            origins.push(current);
            return;
        }
        path.add(current.source);
        const mapped = current.source.mapLocations?.(current)
            ?? [current.source.mapLocation(current)];
        for (const origin of mapped) {
            if (origin.source === current.source
                && origin.span.start === current.span.start
                && origin.span.end === current.span.end) {
                origins.push(current);
            } else {
                visit(origin, path);
            }
        }
        path.delete(current.source);
    }

    visit(location, new Set<object>());
    return origins;
}

/** Compare a compiler location with an editor cursor, including the file. */
export function containsSourceOffset(
    location: Location | undefined,
    position: SourceOffset
): boolean {
    if (!location) return false;
    const mapped = mapToOriginalLocation(location);
    return mapped.source.uri === position.uri
        && contains(mapped.span, position.offset);
}
