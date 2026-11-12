// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { SourceValue } from '../core/sourceValue';
import type { SemanticSymbol } from './symbol';
import type { SymbolReference } from './symbolReference';

/**
 * The mode of a single, resolved use. It is independent of the syntactic
 * SymbolReferenceKind: a NameSegment, for example, is a read in an expression
 * and a write on the left side of an assignment.
 *
 * Address means that another context can access the object (not necessarily
 * that its value is read). Unknown is deliberately conservative: an ambiguous
 * use must not produce a misleading read-only or write-only diagnostic.
 */
export enum SymbolAccessKind {
    Read = 'read',
    Write = 'write',
    Address = 'address',
    Implicit = 'implicit',
    Unknown = 'unknown'
}

export interface SymbolAccess {
    readonly kind: SymbolAccessKind;
    /** Implicit uses (e.g. TASK MAIN) have no explicit reference. */
    readonly reference?: SymbolReference;
}

/**
 * Usage information for one declaration in the current translation unit.
 *
 * Identity is the original definition SourceValue, not the symbol's spelling
 * or its mapped editor location. A local SPC and its PROC/TASK definition
 * share a single entry.
 *
 * The booleans summarize presence of access modes, NOT execution order.
 * No control-flow or definite-assignment analysis is performed here.
 */
export interface SymbolUsage {
    readonly symbol: SemanticSymbol;
    readonly declaration: SourceValue<string>;
    readonly references: readonly SymbolReference[];
    readonly accesses: readonly SymbolAccess[];
    readonly read: boolean;
    readonly written: boolean;
    readonly addressTaken: boolean;
    readonly uncertain: boolean;
    /** Semantic INIT value, distinct from a runtime write. */
    readonly initialized: boolean;
    /** May be used externally: GLOBAL, any TASK, or a compiler +G procedure entry. */
    readonly externallyVisible: boolean;
    /** E.g. TASK MAIN runs without an explicit PEARL reference. */
    readonly implicitlyUsed: boolean;
    /** True only when there is no known or assumed use. */
    readonly unused: boolean;
}

/** Compiler-side result, reusable by diagnostics and semantic tokens. */
export class SymbolUsageIndex {
    readonly all: readonly SymbolUsage[];
    private readonly byDeclaration: ReadonlyMap<SourceValue<string>, SymbolUsage>;
    private readonly byReference: ReadonlyMap<SourceValue<string>, SymbolUsage>;
    private readonly accessesByReference: ReadonlyMap<SourceValue<string>, SymbolAccess>;

    constructor(usages: readonly SymbolUsage[] = []) {
        this.all = Object.freeze(usages.map(usage => Object.freeze({
            ...usage,
            references: Object.freeze([...usage.references]),
            accesses: Object.freeze(usage.accesses.map(access => Object.freeze({ ...access })))
        })));
        this.byDeclaration = new Map(this.all.map(usage => [usage.declaration, usage]));

        const byReference = new Map<SourceValue<string>, SymbolUsage>();
        const accessesByReference = new Map<SourceValue<string>, SymbolAccess>();
        for (const usage of this.all) {
            for (const access of usage.accesses) {
                if (!access.reference) continue;
                byReference.set(access.reference.identifier, usage);
                accessesByReference.set(access.reference.identifier, access);
            }
        }
        this.byReference = byReference;
        this.accessesByReference = accessesByReference;
    }

    lookupDeclaration(declaration: SourceValue<string>): SymbolUsage | undefined {
        return this.byDeclaration.get(declaration);
    }

    /** The containing declaration for one syntactic reference, if it was bound. */
    lookupReference(identifier: SourceValue<string>): SymbolUsage | undefined {
        return this.byReference.get(identifier);
    }

    /** Classified access at a reference site; does not include a declaration. */
    lookupAccess(identifier: SourceValue<string>): SymbolAccess | undefined {
        return this.accessesByReference.get(identifier);
    }
}
