// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { SemanticSymbol } from './symbol';

export enum ScopeKind {
    Module,
    Task,
    Procedure,
    Block,
    Repetition,
}

export interface Scope {

    readonly kind: ScopeKind;

    readonly parent: Scope | undefined;

    readonly symbols: readonly SemanticSymbol[];
}