// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { Location } from '../core/location';
import type { Span } from '../core/span';
import type { Source } from './source';

/**
 * A text source assembled from fragments that retain their individual origins.
 * This is an infrastructure type; it does not expand macros or tokenize PEARL.
 */
export class ExpandedSource implements Source {
    private readonly fragments: readonly ExpandedFragment[];
    private readonly _text: string;

    constructor(
        private readonly root: Source,
        fragments: readonly ExpandedFragment[]
    ) {
        this.fragments = fragments.map(fragment => ({
            text: fragment.text,
            origin: fragment.origin,
            mapping: fragment.mapping
        }));
        this._text = this.fragments.map(fragment => fragment.text).join('');
    }

    get uri(): string {
        return this.root.uri;
    }

    get text(): string {
        return this._text;
    }

    get length(): number {
        return this._text.length;
    }

    getText(span?: Span): string {
        return span ? this._text.slice(span.start, span.end) : this._text;
    }

    /**
     * Map every contributing portion of an expanded range to its immediate
     * origin. Direct fragments yield exact intersections; generated fragments
     * yield their complete macro invocation as an anchor.
     *
     * Adjacent direct fragments of the same Source are merged only if their
     * physical spans are consecutive. Generated fragments are never merged
     * with neighbors, even when their invocation spans happen to touch.
     *
     * This is a complementary API: mapLocation() remains the single primary
     * location used by existing diagnostics and editor navigation.
     */
    mapLocations(location: Location): readonly Location[] {
        this.assertOwnLocation(location);
        if (location.span.start === location.span.end) {
            return [this.mapLocation(location)];
        }

        const origins: Location[] = [];
        let lastWasDirect = false;
        let offset = 0;
        for (const fragment of this.fragments) {
            const end = offset + fragment.text.length;
            const overlapStart = Math.max(offset, location.span.start);
            const overlapEnd = Math.min(end, location.span.end);
            if (overlapStart < overlapEnd) {
                if (fragment.mapping === 'generated') {
                    origins.push(fragment.origin);
                    lastWasDirect = false;
                } else {
                    const current: Location = {
                        source: fragment.origin.source,
                        span: {
                            start: fragment.origin.span.start + overlapStart - offset,
                            end: fragment.origin.span.start + overlapEnd - offset
                        }
                    };
                    const previous = origins[origins.length - 1];
                    if (lastWasDirect && previous
                        && previous.source === current.source
                        && previous.span.end === current.span.start) {
                        origins[origins.length - 1] = {
                            source: previous.source,
                            span: { start: previous.span.start, end: current.span.end }
                        };
                    } else {
                        origins.push(current);
                    }
                    lastWasDirect = true;
                }
            }
            offset = end;
            if (offset >= location.span.end) break;
        }
        return origins;
    }

    private assertOwnLocation(location: Location): void {
        if (location.source !== this) {
            throw new Error('Location does not belong to this ExpandedSource.');
        }
        if (location.span.start < 0 || location.span.end < location.span.start
            || location.span.end > this.length) {
            throw new RangeError('Location is outside this ExpandedSource.');
        }
    }

    mapLocation(location: Location): Location {
        this.assertOwnLocation(location);

        let offset = 0;
        for (let i = 0; i < this.fragments.length; i++) {
            const fragment = this.fragments[i]!;
            const end = offset + fragment.text.length;
            // Empty spans at the end of the source are useful for EOF diagnostics.
            const ownsStart = location.span.start < end
                || (location.span.start === end && end === this.length);
            if (ownsStart && location.span.start >= offset) {
                const relativeStart = location.span.start - offset;
                if (fragment.mapping === 'direct') {
                    const mappedStart = fragment.origin.span.start + relativeStart;
                    const mappedEnd = fragment.origin.span.start
                        + Math.min(location.span.end, end) - offset;

                    if (location.span.end <= end) {
                        return {
                            source: fragment.origin.source,
                            span: { start: mappedStart, end: mappedEnd }
                        };
                    }

                    // An output token may cross several fragments that represent
                    // consecutive characters of the same physical source. In that
                    // case its entire original span is known, even though the
                    // preprocessor emitted the characters in separate operations.
                    let coveredEnd = end;
                    let originalEnd = mappedEnd;
                    for (let j = i + 1;
                        j < this.fragments.length && coveredEnd < location.span.end;
                        j++) {
                        const next = this.fragments[j]!;
                        if (next.mapping !== 'direct'
                            || next.origin.source !== fragment.origin.source
                            || next.origin.span.start !== originalEnd) {
                            break;
                        }
                        originalEnd += Math.min(
                            next.text.length, location.span.end - coveredEnd
                        );
                        coveredEnd += next.text.length;
                    }
                    if (coveredEnd >= location.span.end) {
                        return {
                            source: fragment.origin.source,
                            span: { start: mappedStart, end: originalEnd }
                        };
                    }

                    // A token assembled from distinct origins cannot be expressed
                    // as one Location. Preserve the existing first-fragment anchor.
                    return {
                        source: fragment.origin.source,
                        span: { start: mappedStart, end: mappedEnd }
                    };
                }
                // Generated text has no character-by-character physical origin.
                // Use the macro invocation as its anchor, including at a boundary.
                return fragment.origin;
            }
            offset = end;
        }
        // Empty expansion: retain the root source as an EOF anchor.
        return { source: this.root, span: { start: 0, end: 0 } };
    }
}

export interface ExpandedFragment {
    readonly text: string;
    readonly origin: Location;
    /** 'direct': equal-length source slice; 'generated': anchor to macro use. */
    readonly mapping: 'direct' | 'generated';
}

/** Build the output in source order, preserving origins before concatenation. */
export class ExpandedSourceBuilder {
    private readonly fragments: ExpandedFragment[] = [];

    constructor(private readonly root: Source) {}

    appendOriginal(location: Location): void {
        const text = location.source.getText(location.span);
        if (text.length !== location.span.end - location.span.start) {
            throw new Error('Original fragment length does not match its source span.');
        }
        if (text.length) this.fragments.push({ text, origin: location, mapping: 'direct' });
    }

    appendExpansion(text: string, invocation: Location): void {
        if (text.length) {
            this.fragments.push({ text, origin: invocation, mapping: 'generated' });
        }
    }

    build(): ExpandedSource {
        return new ExpandedSource(this.root, this.fragments);
    }
}
