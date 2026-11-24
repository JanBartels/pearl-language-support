// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { Location } from '../../core/location';
import type { Span } from '../../core/span';
import { ExpandedSource, type ExpandedFragment } from '../../source/expandedSource';
import { FileSource } from '../../source/fileSource';
import { MacroSource } from '../../source/macroSource';
import type { Source } from '../../source/source';

/**
 * Versioned, data-only transport for the source-mapping subgraph of one analysis.
 *
 * It deliberately does NOT serialize AnalysisResult or arbitrary class instances.
 * All Source references (including multiple FileSource objects with the same URI)
 * are represented by per-message identities, not by URI or object properties.
 *
 * Numeric IDs are local to one transfer; never cache or persist them across
 * analyses. The transport is suitable for structuredClone/postMessage/JSON.
 */
export const SOURCE_GRAPH_TRANSPORT_VERSION = 1 as const;

export interface SourceLocationWire {
    readonly sourceId: number;
    readonly span: Readonly<Span>;
}

export interface SourceFragmentWire {
    readonly text: string;
    readonly origin: SourceLocationWire;
    readonly mapping: 'direct' | 'generated';
}

export type SourceNodeWire =
    | { readonly kind: 'file'; readonly id: number; readonly uri: string; readonly text: string }
    | { readonly kind: 'macro'; readonly id: number; readonly text: string; readonly expansion: SourceLocationWire }
    | { readonly kind: 'expanded'; readonly id: number; readonly rootId: number; readonly fragments: readonly SourceFragmentWire[] };

export interface SourceGraphWire {
    readonly version: typeof SOURCE_GRAPH_TRANSPORT_VERSION;
    readonly roots: readonly number[];
    readonly nodes: readonly SourceNodeWire[];
}

export interface DecodedSourceGraph {
    readonly roots: readonly Source[];
    /** Resolve an identity reference from a wire location (never by URI). */
    resolve(id: number): Source;
    decodeLocation(location: SourceLocationWire): Location;
}

/**
 * Keep the encoder session alive while converting other fields such as
 * diagnostics, SourceValues and AST records. Every field must share ONE ID map.
 */
export class SourceGraphEncoder {
    private readonly ids = new Map<Source, number>();
    private readonly nodes: SourceNodeWire[] = [];

    encodeSource(source: Source): number {
        const existing = this.ids.get(source);
        if (existing !== undefined) return existing;

        // Reserving the ID before descending is essential for stable aliases.
        const id = this.nodes.length + 1;
        this.ids.set(source, id);
        // A placeholder reserves the slot until all child IDs are known.
        this.nodes.push(undefined as unknown as SourceNodeWire);

        let node: SourceNodeWire;
        // instanceof is used only at the explicit technical transport boundary.
        if (source instanceof FileSource) {
            node = { kind: 'file', id, uri: source.uri, text: source.text };
        } else if (source instanceof MacroSource) {
            node = {
                kind: 'macro', id, text: source.text,
                expansion: this.encodeLocation(source.expansionLocation)
            };
        } else if (source instanceof ExpandedSource) {
            node = {
                kind: 'expanded', id,
                rootId: this.encodeSource(source.rootSource),
                fragments: source.originalFragments.map(fragment => ({
                    text: fragment.text,
                    mapping: fragment.mapping,
                    origin: this.encodeLocation(fragment.origin)
                }))
            };
        } else {
            throw new Error(`Unknown Source implementation at transfer boundary: ${source.constructor?.name ?? 'unknown'}`);
        }
        this.nodes[id - 1] = node;
        return id;
    }

    encodeLocation(location: Location): SourceLocationWire {
        return {
            sourceId: this.encodeSource(location.source),
            span: { start: location.span.start, end: location.span.end }
        };
    }

    finish(roots: readonly Source[]): SourceGraphWire {
        const rootIds = roots.map(root => this.encodeSource(root));
        // Copy all arrays so no subsequent encoder call can mutate a built message.
        return {
            version: SOURCE_GRAPH_TRANSPORT_VERSION,
            roots: rootIds,
            nodes: [...this.nodes]
        };
    }
}

export function encodeSourceGraph(roots: readonly Source[]): SourceGraphWire {
    return new SourceGraphEncoder().finish(roots);
}

/**
 * Materialize FileSource, MacroSource and ExpandedSource using their real
 * constructors. Never assign prototypes to structured-cloned objects.
 */
export function decodeSourceGraph(wire: SourceGraphWire): DecodedSourceGraph {
    if (wire.version !== SOURCE_GRAPH_TRANSPORT_VERSION) {
        throw new Error(`Unsupported SourceGraph transport version: ${String(wire.version)}`);
    }
    if (!Array.isArray(wire.nodes) || !Array.isArray(wire.roots)) {
        throw new Error('Malformed SourceGraph: missing nodes or roots.');
    }
    const records = new Map<number, SourceNodeWire>();
    for (const record of wire.nodes) {
        if (!isValidId(record.id) || records.has(record.id)) {
            throw new Error(`Duplicate or invalid SourceGraph node identity: ${String(record.id)}`);
        }
        records.set(record.id, record);
    }
    const decoded = new Map<number, Source>();
    const visiting = new Set<number>();

    const resolve = (id: number): Source => {
        if (!isValidId(id)) throw new Error(`Invalid SourceGraph reference: ${String(id)}`);
        const existing = decoded.get(id);
        if (existing !== undefined) return existing;
        const record = records.get(id);
        if (!record) throw new Error(`Missing SourceGraph node: ${id}`);
        if (visiting.has(id)) throw new Error(`Cyclic SourceGraph origin chain at node ${id}`);
        visiting.add(id);
        try {
            let source: Source;
            switch (record.kind) {
                case 'file':
                    source = new FileSource(record.uri, record.text);
                    break;
                case 'macro':
                    source = new MacroSource(decodeLocation(record.expansion), record.text);
                    break;
                case 'expanded': {
                    const root = resolve(record.rootId);
                    const fragments: ExpandedFragment[] = record.fragments.map(fragment => {
                        if (fragment.mapping !== 'direct' && fragment.mapping !== 'generated') {
                            throw new Error(`Invalid SourceGraph fragment mapping in node ${id}`);
                        }
                        const origin = decodeLocation(fragment.origin);
                        if (fragment.mapping === 'direct' &&
                            (origin.span.end - origin.span.start !== fragment.text.length ||
                             origin.source.getText(origin.span) !== fragment.text)) {
                            throw new Error(`Mismatched direct SourceGraph fragment in node ${id}`);
                        }
                        return {
                            text: fragment.text,
                            mapping: fragment.mapping,
                            origin
                        };
                    });
                    source = new ExpandedSource(root, fragments);
                    break;
                }
                default: {
                    const exhaustive: never = record;
                    throw new Error(`Unknown SourceGraph node kind: ${String(exhaustive)}`);
                }
            }
            decoded.set(id, source);
            return source;
        } finally {
            visiting.delete(id);
        }
    };

    const decodeLocation = (location: SourceLocationWire): Location => {
        const source = resolve(location.sourceId);
        const { start, end } = location.span;
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)
            || start < 0 || end < start || end > source.length) {
            throw new Error(`SourceGraph location outside source ${location.sourceId}: ${start}..${end}`);
        }
        return { source, span: { start, end } };
    };

    const roots = wire.roots.map(resolve);
    // Decode even unreachable records: a broken auxiliary node must not be
    // silently accepted by a future AnalysisResult transport.
    for (const id of records.keys()) resolve(id);
    return { roots, resolve, decodeLocation };
}

function isValidId(id: number): boolean {
    return Number.isSafeInteger(id) && id > 0;
}
