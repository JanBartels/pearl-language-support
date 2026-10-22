// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { Location } from '../core/location';


export enum SemanticDiagnosticSeverity {
    Error,
    Warning,
}


export enum SemanticDiagnosticCode {
    DuplicateShellProcedure = 'semantic.duplicate-shell-procedure',
    DuplicateShellCommand = 'semantic.duplicate-shell-command',
    MissingShellProcedure = 'semantic.missing-shell-procedure',
    InvalidShellProcedureSignature = 'semantic.invalid-shell-procedure-signature',
    UnregisteredShellProcedure = 'semantic.unregistered-shell-procedure',
    MissingLocalProcedureDefinition = 'semantic.missing-local-procedure-definition',
    MissingLocalTaskDefinition = 'semantic.missing-local-task-definition',
    LocalProcedureSpecificationMismatch = 'semantic.local-procedure-specification-mismatch',
    InvalidCallTarget = 'semantic.invalid-call-target',
    InvalidCallArity = 'semantic.invalid-call-arity',
    UnknownType = 'semantic.unknown-type',
    ExpectedType = 'semantic.expected-type',
    DuplicateType = 'semantic.duplicate-type',
    DuplicateDeclaration = 'semantic.duplicate-declaration',
    DeclarationAfterProcedureOrTask = 'semantic.declaration-after-procedure-or-task',
    MultipleModulesInTranslationUnit = 'semantic.multiple-modules-in-translation-unit',
    SpecificationMismatch = 'semantic.specification-mismatch',
    DataSpecificationRequiresGlobal = 'semantic.data-specification-requires-global',
    MissingDeclarationForSpecification = 'semantic.missing-declaration-for-specification',
    SystemSpecificationMismatch = 'semantic.system-specification-mismatch',
    MissingSystemDeclarationForSpecification = 'semantic.missing-system-declaration-for-specification',
    InvalidDeclarationScope = 'semantic.invalid-declaration-scope',
    GlobalDeclarationOutsideModule = 'semantic.global-declaration-outside-module',
    InvariantWithoutInitialization = 'semantic.invariant-without-initialization',
    InvalidSemaPresetValue = 'semantic.invalid-sema-preset-value',
    SemaPresetElementCount = 'semantic.sema-preset-element-count',
    ConstantExpressionNotEvaluable = 'semantic.constant-expression-not-evaluable',
    UnknownIdentifier = 'semantic.unknown-identifier',
    ExpectedNamedFixedConstant = 'semantic.expected-named-fixed-constant',
    ExpectedNamedConstant = 'semantic.expected-named-constant',
    InitializationElementCount = 'semantic.initialization-element-count',
    InvalidFixedInitialization = 'semantic.invalid-fixed-initialization',
    InvalidInitialization = 'semantic.invalid-initialization',
    InitializationValueTooLong = 'semantic.initialization-value-too-long',
    InvalidClockConstant = 'semantic.invalid-clock-constant',
    TimeResolutionLoss = 'semantic.time-resolution-loss',
    InvalidTaskPriority = 'semantic.invalid-task-priority',
    UnknownCompilerMode = 'semantic.unknown-compiler-mode',
    MarkerOptionWithoutNoLineStop = 'semantic.marker-option-without-nolstop',
    GOptionOutsideProcedureHeader = 'semantic.g-option-outside-proc-header',
    GProcedureAfterFirstTask = 'semantic.g-procedure-after-first-task',
    GProcedureRequiresGlobal = 'semantic.g-procedure-requires-global',
}


export interface SemanticDiagnosticRelatedLocation {

    readonly location: Location;

    readonly message: string;
}


export interface SemanticDiagnostic {

    readonly code: SemanticDiagnosticCode;

    readonly severity: SemanticDiagnosticSeverity;

    readonly location: Location;

    readonly message: string;

    readonly relatedLocations?: readonly SemanticDiagnosticRelatedLocation[];
}
