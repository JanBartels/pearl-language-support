// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { SourceValue } from '../core/sourceValue';
import type { SemanticSymbol } from './symbol';

export type BindingIndex =
    ReadonlyMap<SourceValue<string>, SemanticSymbol>;
