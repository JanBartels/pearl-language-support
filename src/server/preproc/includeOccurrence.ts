// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { Span } from '../core/span';

/**
 * One physical #include directive along a path from a translation unit.
 * Offsets refer to the directive itself, not to the optionally macro-expanded
 * file name. A nested include is identified by its entire path of sites.
 */
export interface IncludeSite {
    readonly includingUri: string;
    readonly directiveOffset: number;
    readonly includedUri: string;
}

/**
 * A single execution of #include in one preprocessor run.
 *
 * `expandedSpan` refers to the complete textual expansion of this occurrence
 * in the run's ExpandedSource. Nested occurrences lie inside their parents'
 * spans. An empty or conditionally disabled include may have an empty span.
 *
 * The stable identity is deliberately independent of output offsets: output
 * may grow or shrink without changing which physical directive was executed.
 */
export interface IncludeOccurrence {
    readonly id: string;
    readonly sourceUri: string;
    readonly sites: readonly IncludeSite[];
    readonly expandedSpan: Readonly<Span>;
}

/** Distinguishes repeated nested includes, even at the same inner directive. */
export function includeOccurrenceId(sites: readonly IncludeSite[]): string {
    return JSON.stringify(sites.map(site => [
        site.includingUri, site.directiveOffset, site.includedUri
    ]));
}
