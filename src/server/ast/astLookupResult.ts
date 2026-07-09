// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../core/sourceValue';
import { AstNode } from './astNode';


export interface AstLookupResult {

    readonly node: AstNode;

    readonly element: SourceValue<unknown>;
}
