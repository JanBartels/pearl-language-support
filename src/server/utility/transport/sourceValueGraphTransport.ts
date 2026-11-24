// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../core/sourceValue';
import type { Source } from '../../source/source';
import {
    SourceGraphEncoder, decodeSourceGraph,
    type SourceGraphWire, type SourceLocationWire, type DecodedSourceGraph
} from './sourceGraphTransport';

/**
 * Separate, identity-preserving wire table for SourceValues. Compiler semantic
 * maps use these objects as keys; equal values/locations do not imply equality.
 *
 * This table can later be referenced by AST records, bindings and occurrence
 * indices. It is NOT a serializer for arbitrary AST or SemanticContext objects.
 */
export type SourceValueLiteralWire =
    | { readonly kind: 'string'; readonly value: string }
    | { readonly kind: 'boolean'; readonly value: boolean }
    | { readonly kind: 'number'; readonly value: number }
    | { readonly kind: 'bigint'; readonly decimal: string }
    | { readonly kind: 'null' }
    | { readonly kind: 'undefined' };

export interface SourceValueNodeWire {
    readonly id: number;
    readonly value: SourceValueLiteralWire;
    readonly location?: SourceLocationWire;
    readonly lexicalLocation?: SourceLocationWire;
}

export interface SourceValueGraphWire {
    readonly version: 1;
    readonly sources: SourceGraphWire;
    readonly values: readonly SourceValueNodeWire[];
}

export interface DecodedSourceValueGraph {
    readonly sources: DecodedSourceGraph;
    resolve(id: number): SourceValue<unknown>;
}

export class SourceValueGraphEncoder {
    readonly sources = new SourceGraphEncoder();
    private readonly ids = new Map<SourceValue<unknown>, number>();
    private readonly values: SourceValueNodeWire[] = [];

    encode(value: SourceValue<unknown>): number {
        const id = this.ids.get(value);
        if (id !== undefined) return id;
        // Reject unsupported values before allocating an identity. A failing
        // encode must never poison the session's ID table.
        const payload = encodeLiteral(value.value);
        const location = value.location ? this.sources.encodeLocation(value.location) : undefined;
        const lexicalLocation = value.lexicalLocation
            ? this.sources.encodeLocation(value.lexicalLocation) : undefined;
        const next = this.values.length + 1;
        this.ids.set(value, next);
        this.values.push({
            id: next, value: payload,
            ...(location ? { location } : {}),
            ...(lexicalLocation ? { lexicalLocation } : {})
        });
        return next;
    }

    finish(roots: readonly Source[] = []): SourceValueGraphWire {
        return { version: 1, sources: this.sources.finish(roots), values: [...this.values] };
    }
}

export function decodeSourceValueGraph(wire: SourceValueGraphWire): DecodedSourceValueGraph {
    if (wire.version !== 1 || !Array.isArray(wire.values)) {
        throw new Error('Unsupported or malformed SourceValueGraph transport version.');
    }
    const sources = decodeSourceGraph(wire.sources);
    const values = new Map<number, SourceValue<unknown>>();
    for (const item of wire.values) {
        if (!Number.isSafeInteger(item.id) || item.id <= 0 || values.has(item.id)) {
            throw new Error(`Invalid or duplicate SourceValue identity: ${String(item.id)}`);
        }
        const value = new SourceValue(
            decodeLiteral(item.value),
            item.location ? sources.decodeLocation(item.location) : undefined,
            item.lexicalLocation ? sources.decodeLocation(item.lexicalLocation) : undefined
        );
        values.set(item.id, value);
    }
    return {
        sources,
        resolve(id: number): SourceValue<unknown> {
            const value = values.get(id);
            if (!value) throw new Error(`Missing SourceValue identity: ${String(id)}`);
            return value;
        }
    };
}

function encodeLiteral(value: unknown): SourceValueLiteralWire {
    if (value === undefined) return { kind: 'undefined' };
    if (value === null) return { kind: 'null' };
    if (typeof value === 'string') return { kind: 'string', value };
    if (typeof value === 'boolean') return { kind: 'boolean', value };
    if (typeof value === 'bigint') return { kind: 'bigint', decimal: value.toString(10) };
    if (typeof value === 'number' && Number.isFinite(value)) return { kind: 'number', value };
    throw new Error(`Unsupported SourceValue payload at transfer boundary: ${typeof value}`);
}

function decodeLiteral(value: SourceValueLiteralWire): unknown {
    switch (value.kind) {
        case 'undefined': return undefined;
        case 'null': return null;
        case 'string': return value.value;
        case 'number':
            if (!Number.isFinite(value.value)) throw new Error('Non-finite SourceValue number.');
            return value.value;
        case 'boolean': return value.value;
        case 'bigint':
            if (!/^-?(0|[1-9][0-9]*)$/.test(value.decimal)) {
                throw new Error('Invalid SourceValue bigint representation.');
            }
            return BigInt(value.decimal);
        default: {
            const exhaustive: never = value;
            throw new Error(`Unknown SourceValue literal kind: ${String(exhaustive)}`);
        }
    }
}
