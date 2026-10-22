// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { AstNode } from '../ast/astNode';
import type { ModuleNode } from '../ast/module/moduleNode';
import type { ShellCommandNode } from '../ast/module/shellCommandNode';
import type { ProcedureDeclarationNode } from '../ast/problem/declarations/procedureDeclarationNode';
import type { ConstantFixedExpressionNode } from '../ast/problem/expressions/constantFixedExpressionNode';
import type { BindingIndex } from './bindingIndex';
import type { LocalSpecificationRelationIndex } from './localSpecificationRelation';
import type { BuiltinDefinition } from './builtins/builtinSignature';
import type { SourceValue } from '../core/sourceValue';
import { SemanticInitialValueKind } from './semanticConstantValue';
import type {
    FixedConstantValue,
    SemanticConstantValue,
    SemanticInitialValue,
    TimeConstantValue
} from './semanticConstantValue';
import type { SemanticDiagnostic } from './semanticDiagnostic';
import type { ModuleConfiguration } from './moduleConfiguration';
import type { SemanticType } from './semanticType';
import type { DataObjectSymbol, TypeSymbol } from './symbol';

export class SemanticContext {
    readonly typeDefinitions: ReadonlyMap<TypeSymbol, SemanticType>;
    readonly bindings: BindingIndex;
    readonly builtinBindings: ReadonlyMap<SourceValue<string>, BuiltinDefinition>;
    readonly diagnostics: readonly SemanticDiagnostic[];
    readonly constantFixedExpressionValues: ReadonlyMap<ConstantFixedExpressionNode, FixedConstantValue>;
    readonly namedConstantValues: ReadonlyMap<DataObjectSymbol, SemanticConstantValue>;
    readonly initialValues: ReadonlyMap<DataObjectSymbol, SemanticInitialValue>;
    readonly constantFixedValues: ReadonlyMap<AstNode, FixedConstantValue>;
    readonly timeConstantValues: ReadonlyMap<AstNode, TimeConstantValue>;
    readonly semaPresetValues: ReadonlyMap<DataObjectSymbol, readonly FixedConstantValue[]>;
    readonly moduleConfigurations: ReadonlyMap<ModuleNode, ModuleConfiguration>;
    readonly shellCommandsByProcedure: ReadonlyMap<ProcedureDeclarationNode, ShellCommandNode>;
    readonly localSpecificationRelations: LocalSpecificationRelationIndex;

    constructor(
        typeDefinitions: ReadonlyMap<TypeSymbol, SemanticType> = new Map(),
        bindings: BindingIndex = new Map(),
        diagnostics: readonly SemanticDiagnostic[] = [],
        constantFixedExpressionValues: ReadonlyMap<ConstantFixedExpressionNode, FixedConstantValue> = new Map(),
        namedConstantValues: ReadonlyMap<DataObjectSymbol, SemanticConstantValue> = new Map(),
        initialValues: ReadonlyMap<DataObjectSymbol, SemanticInitialValue> = new Map(),
        constantFixedValues: ReadonlyMap<AstNode, FixedConstantValue> = new Map(),
        timeConstantValues: ReadonlyMap<AstNode, TimeConstantValue> = new Map(),
        semaPresetValues: ReadonlyMap<DataObjectSymbol, readonly FixedConstantValue[]> = new Map(),
        moduleConfigurations: ReadonlyMap<ModuleNode, ModuleConfiguration> = new Map(),
        shellCommandsByProcedure: ReadonlyMap<ProcedureDeclarationNode, ShellCommandNode> = new Map(),
        builtinBindings: ReadonlyMap<SourceValue<string>, BuiltinDefinition> = new Map(),
        localSpecificationRelations: LocalSpecificationRelationIndex = new Map()
    ) {
        this.typeDefinitions = new Map(typeDefinitions);
        this.bindings = new Map(bindings);
        this.builtinBindings = new Map(builtinBindings);
        this.localSpecificationRelations = new Map(localSpecificationRelations);
        this.diagnostics = [...diagnostics];
        this.constantFixedExpressionValues = new Map(constantFixedExpressionValues);
        this.namedConstantValues = new Map(namedConstantValues);
        this.initialValues = new Map(
            [...initialValues].map(([symbol, value]): [DataObjectSymbol, SemanticInitialValue] => {
                if (value.kind === SemanticInitialValueKind.Constant) {
                    return [symbol, {
                        kind: SemanticInitialValueKind.Constant,
                        values: [...value.values],
                        elementCount: value.elementCount
                    }];
                }

                return [symbol, {
                    kind: SemanticInitialValueKind.Reference,
                    values: [...value.values],
                    elementCount: value.elementCount
                }];
            })
        );
        this.constantFixedValues = new Map(constantFixedValues);
        this.timeConstantValues = new Map(timeConstantValues);
        this.semaPresetValues = new Map(
            [...semaPresetValues].map(([symbol, values]) => [symbol, [...values]])
        );
        this.shellCommandsByProcedure = new Map(shellCommandsByProcedure);
        this.moduleConfigurations = new Map(
            [...moduleConfigurations].map(([module, configuration]) => [
                module,
                {
                    modes: [...configuration.modes],
                    timeResolution: { ...configuration.timeResolution },
                    fullCharacterComparison: configuration.fullCharacterComparison,
                    noLineStop: configuration.noLineStop,
                    padding: configuration.padding,
                    debugInformation: configuration.debugInformation,
                    processor: configuration.processor && { ...configuration.processor },
                    moduleSize: configuration.moduleSize && { ...configuration.moduleSize },
                    setLine: configuration.setLine && { ...configuration.setLine },
                    maxErrors: configuration.maxErrors
                }
            ])
        );
    }

    withAdditionalDiagnostics(
        diagnostics: readonly SemanticDiagnostic[]
    ): SemanticContext {
        if (diagnostics.length === 0) {
            return this;
        }

        return new SemanticContext(
            this.typeDefinitions,
            this.bindings,
            [...this.diagnostics, ...diagnostics],
            this.constantFixedExpressionValues,
            this.namedConstantValues,
            this.initialValues,
            this.constantFixedValues,
            this.timeConstantValues,
            this.semaPresetValues,
            this.moduleConfigurations,
            this.shellCommandsByProcedure,
            this.builtinBindings,
            this.localSpecificationRelations
        );
    }

}
