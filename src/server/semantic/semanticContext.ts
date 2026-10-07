// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { BindingIndex } from './bindingIndex';
import type { SemanticDiagnostic } from './semanticDiagnostic';
import type { SemanticType } from './semanticType';
import type { TypeSymbol } from './symbol';


export class SemanticContext {

    readonly typeDefinitions: ReadonlyMap<TypeSymbol, SemanticType>;
    readonly bindings: BindingIndex;
    readonly diagnostics: readonly SemanticDiagnostic[];


    constructor(
        typeDefinitions: ReadonlyMap<TypeSymbol, SemanticType> = new Map(),
        bindings: BindingIndex = new Map(),
        diagnostics: readonly SemanticDiagnostic[] = []
    ) {
        this.typeDefinitions = new Map(typeDefinitions);
        this.bindings = new Map(bindings);
        this.diagnostics = [...diagnostics];
    }
}
