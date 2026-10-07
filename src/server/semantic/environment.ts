// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { Scope } from './scope';
import type { SemanticSymbol } from './symbol';

export interface Environment {

    readonly scope: Scope;

    readonly previous: Environment | undefined;

    readonly outer: Environment | undefined;

    readonly introducedSymbols: readonly SemanticSymbol[];
}
