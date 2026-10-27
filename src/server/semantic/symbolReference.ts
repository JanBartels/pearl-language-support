// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { AstNode } from '../ast/astNode';
import type { SourceValue } from '../core/sourceValue';

/**
 * Syntactic use of a name, independent of whether a declaration exists.
 *
 * These roles describe the AST construct, not the symbol's eventual type.
 * In particular an initializer may denote a constant's value or the target
 * of a REF initializer. The distinction belongs to semantic analysis.
 *
 * Read and Write are reserved for uses whose access mode is established by
 * the parsed grammar. They need not both occur in the present AST grammar.
 */
export enum SymbolReferenceKind {
    Read = 'read',
    Write = 'write',
    Call = 'call',
    Type = 'type',
    JumpTarget = 'jumpTarget',
    Initialization = 'initialization',
    DationCreationSource = 'dationCreationSource',
    ShellEntryPoint = 'shellEntryPoint',
    BlockEnd = 'blockEnd',
    RepetitionEnd = 'repetitionEnd'
}

/**
 * The identifier keeps its original SourceValue and compiler Location.
 * In particular this is NOT a location mapped from a macro expansion to
 * its invocation site. Editor mapping is performed separately when needed.
 *
 * No resolved symbol is stored here. 7.2 may associate a binding (or a
 * resolution failure) with this occurrence without changing its identity.
 */
export interface SymbolReference {
    readonly identifier: SourceValue<string>;
    readonly kind: SymbolReferenceKind;
    readonly node: AstNode;
}
