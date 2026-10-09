// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../core/sourceValue';
import type { SemanticType } from './semanticType';
import { SymbolKind } from './symbolKind';

export interface SymbolBase {

    readonly kind: SymbolKind;

    readonly name: SourceValue<string>;

    /**
     * Source location of the object represented by this symbol if it differs from the name which introduced the
     * symbol in the current semantic scope.
     *
     * Examples:
     * - a normal DCL/TYPE uses `name` as its definition,
     * - a GLOBAL SPC without a local declaration also uses `name`,
     * - an SPC for a SYSTEM dation or interrupt points to the corresponding SYSTEM declaration.
     */
    readonly definition?: SourceValue<string>;
}

export interface ModuleSymbol extends SymbolBase {

    readonly kind: SymbolKind.Module;
}

export interface TypeSymbol extends SymbolBase {

    readonly kind: SymbolKind.Type;
}

export interface GlobalSymbolAttribute {

    readonly moduleName: SourceValue<string> | undefined;
}

export interface GlobalSymbolBase extends SymbolBase {

    readonly global: GlobalSymbolAttribute | undefined;
}

export interface DataObjectSymbol extends GlobalSymbolBase {

    readonly kind: SymbolKind.DataObject;

    readonly type: SemanticType;

    readonly assignmentProtected: boolean;
}

export interface ParameterSymbol extends SymbolBase {

    readonly kind: SymbolKind.Parameter;
}

export interface IdentificationSymbol extends SymbolBase {

    readonly kind: SymbolKind.Identification;
}

export interface ProcedureSymbol extends GlobalSymbolBase {

    readonly kind: SymbolKind.Procedure;
}

export interface TaskSymbol extends GlobalSymbolBase {

    readonly kind: SymbolKind.Task;
}

export interface LoopControlVariableSymbol extends SymbolBase {

    readonly kind: SymbolKind.LoopControlVariable;
}

export interface LabelSymbol extends SymbolBase {

    readonly kind: SymbolKind.Label;
}

export type SemanticSymbol =
    | ModuleSymbol
    | TypeSymbol
    | DataObjectSymbol
    | ParameterSymbol
    | IdentificationSymbol
    | ProcedureSymbol
    | TaskSymbol
    | LoopControlVariableSymbol
    | LabelSymbol
    ;
