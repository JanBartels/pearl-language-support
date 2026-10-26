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
