// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SymbolTable } from './symbolTable';

export class SemanticContext {

    readonly globalSymbols =
        new SymbolTable();

}
