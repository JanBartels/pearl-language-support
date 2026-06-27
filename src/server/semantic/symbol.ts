// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SymbolKind  } from "./symbolKind";
import { AstNode } from '../ast/astNode';

export interface Symbol {

    readonly name: string;

    readonly kind: SymbolKind;

    readonly declaration: AstNode;
}
