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
    InvalidCallArgumentType = 'semantic.invalid-call-argument-type',
    InvalidExpressionOperands = 'semantic.invalid-expression-operands',
    InvalidArrayIndexCount = 'semantic.invalid-array-index-count',
    InvalidArrayIndexType = 'semantic.invalid-array-index-type',
    InvalidArrayBoundDimension = 'semantic.invalid-array-bound-dimension',
    ConstantIndexOutOfBounds = 'semantic.constant-index-out-of-bounds',
    InvalidStringSelectorIndexType = 'semantic.invalid-string-selector-index-type',
    InvalidStringSelectorIndexCount = 'semantic.invalid-string-selector-index-count',
    InvalidNameSuffix = 'semantic.invalid-name-suffix',
    InvalidStructureSelection = 'semantic.invalid-structure-selection',
    UnknownStructureComponent = 'semantic.unknown-structure-component',
    InvalidFunctionExpression = 'semantic.invalid-function-expression',
    InvalidReturnType = 'semantic.invalid-return-type',
    InvalidBuiltinArgumentType = 'semantic.invalid-builtin-argument-type',
    InvalidIfCondition = 'semantic.invalid-if-condition',
    InvalidWhileCondition = 'semantic.invalid-while-condition',
    InvalidRepetitionFixedExpression = 'semantic.invalid-repetition-fixed-expression',
    InvalidCaseSelector = 'semantic.invalid-case-selector',
    InvalidCaseAlternativeType = 'semantic.invalid-case-alternative-type',
    NonConstantCaseAlternative = 'semantic.nonconstant-case-alternative',
    InvalidCaseRange = 'semantic.invalid-case-range',
    OverlappingCaseAlternative = 'semantic.overlapping-case-alternative',
    UnknownLabel = 'semantic.unknown-label',
    InvalidGotoIntoBlock = 'semantic.invalid-goto-into-block',
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
    InvalidDationCreationSource = 'semantic.invalid-dation-creation-source',
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
    UnknownTargetProcessor = 'semantic.unknown-target-processor',
    InvalidProcessorOption = 'semantic.invalid-processor-option',
    InvalidFpuRegisterCount = 'semantic.invalid-fpu-register-count',
    InvalidCompilerSettingValue = 'semantic.invalid-compiler-setting-value',
    DuplicateCompilerSetting = 'semantic.duplicate-compiler-setting',
    PreferScModuleSize = 'semantic.prefer-sc-module-size',
    MissingProcessorSetting = 'semantic.missing-processor-setting',
    MissingScModuleSize = 'semantic.missing-sc-module-size',
    CompilerSettingWithoutModule = 'semantic.compiler-setting-without-module',
    ReservedModuleId = 'semantic.reserved-module-id',
    LineMarkerLimit = 'semantic.line-marker-limit',
    MissingModendDebug = 'semantic.missing-modend-debug',
    UnexpectedModendDebug = 'semantic.unexpected-modend-debug',
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
