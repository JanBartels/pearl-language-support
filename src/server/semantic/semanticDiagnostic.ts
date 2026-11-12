// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { Location } from '../core/location';
import type { ProblemTag } from '../core/problemTag';


export enum SemanticDiagnosticSeverity {
    Error,
    Warning,
}


export enum SemanticDiagnosticCode {
    UnusedSymbol = 'semantic.unused-symbol',
    WrittenButNeverRead = 'semantic.written-but-never-read',
    ReadButNeverWritten = 'semantic.read-but-never-written',
    DuplicateShellProcedure = 'semantic.duplicate-shell-procedure',
    DuplicateShellCommand = 'semantic.duplicate-shell-command',
    InvalidShellCommandName = 'semantic.invalid-shell-command-name',
    MissingShellProcedure = 'semantic.missing-shell-procedure',
    InvalidShellProcedureSignature = 'semantic.invalid-shell-procedure-signature',
    UnregisteredShellProcedure = 'semantic.unregistered-shell-procedure',
    MissingLocalProcedureDefinition = 'semantic.missing-local-procedure-definition',
    MissingLocalTaskDefinition = 'semantic.missing-local-task-definition',
    LocalProcedureSpecificationMismatch = 'semantic.local-procedure-specification-mismatch',
    InvalidCallTarget = 'semantic.invalid-call-target',
    InvalidCallArity = 'semantic.invalid-call-arity',
    InvalidCallArgumentType = 'semantic.invalid-call-argument-type',
    InvalidIdentificationArgument = 'semantic.invalid-identification-argument',
    ReferenceTargetProtectionLoss = 'semantic.reference-target-protection-loss',
    MutableReferenceToCharacterLiteral = 'semantic.mutable-reference-to-character-literal',
    InvalidTaskingTarget = 'semantic.invalid-tasking-target',
    InvalidTaskingInterrupt = 'semantic.invalid-tasking-interrupt',
    InvalidInterruptOperand = 'semantic.invalid-interrupt-operand',
    InvalidTaskingTimeType = 'semantic.invalid-tasking-time-type',
    NegativeTaskingDuration = 'semantic.negative-tasking-duration',
    InvalidTaskingPriorityType = 'semantic.invalid-tasking-priority-type',
    InvalidSemaSetValue = 'semantic.invalid-semaset-value',
    InvalidSynchronizationOperand = 'semantic.invalid-synchronization-operand',
    InvalidExpressionOperands = 'semantic.invalid-expression-operands',
    UnsupportedBitConcatenation = 'semantic.unsupported-bit-concatenation',
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
    InvalidAssignmentTarget = 'semantic.invalid-assignment-target',
    AssignmentToInvariant = 'semantic.assignment-to-invariant',
    InvalidAssignmentValueType = 'semantic.invalid-assignment-value-type',
    PossibleCharacterTruncation = 'semantic.possible-character-truncation',
    InvalidArrayAssignment = 'semantic.invalid-array-assignment',
    InvalidContAssignmentTarget = 'semantic.invalid-cont-assignment-target',
    UnsupportedContExpression = 'semantic.unsupported-cont-expression',
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
    LocalSynchronizationObject = 'semantic.local-synchronization-object',
    InvalidFormattedIoDation = 'semantic.invalid-formatted-io-dation',
    InvalidFormattedIoDirection = 'semantic.invalid-formatted-io-direction',
    InvalidFormattedIoTarget = 'semantic.invalid-formatted-io-target',
    InvalidFormattedIoData = 'semantic.invalid-formatted-io-data',
    InvalidFormatReference = 'semantic.invalid-format-reference',
    InvalidFormatReportVariable = 'semantic.invalid-format-report-variable',
    IncompatibleFormattedIoFormat = 'semantic.incompatible-formatted-io-format',
    ImplicitFormatListRepetition = 'semantic.implicit-format-list-repetition',
    ExcessFormattedIoFormats = 'semantic.excess-formatted-io-formats',
    InvalidBasicTransferDation = 'semantic.invalid-basic-transfer-dation',
    InvalidBasicTransferDirection = 'semantic.invalid-basic-transfer-direction',
    InvalidBasicTakeTarget = 'semantic.invalid-basic-take-target',
    InvalidBasicTransferData = 'semantic.invalid-basic-transfer-data',
    InvalidBinaryTransferDation = 'semantic.invalid-binary-transfer-dation',
    InvalidBinaryTransferDirection = 'semantic.invalid-binary-transfer-direction',
    InvalidBinaryReadTarget = 'semantic.invalid-binary-read-target',
    InvalidIoSegment = 'semantic.invalid-io-segment',
    InvalidBinaryTransferSFormat = 'semantic.invalid-binary-transfer-s-format',
    InvalidDationControlTarget = 'semantic.invalid-dation-control-target',
    InvalidDationControlOption = 'semantic.invalid-dation-control-option',
    DuplicateDationControlOption = 'semantic.duplicate-dation-control-option',
    ConflictingDationControlOptions = 'semantic.conflicting-dation-control-options',
    InvalidDationControlIdf = 'semantic.invalid-dation-control-idf',
    InvalidDationCreationSource = 'semantic.invalid-dation-creation-source',
    IncompatibleDationCreation = 'semantic.incompatible-dation-creation',
    GlobalDeclarationOutsideModule = 'semantic.global-declaration-outside-module',
    InvariantWithoutInitialization = 'semantic.invariant-without-initialization',
    InvalidInvariantSynchronizationObject = 'semantic.invalid-invariant-synchronization-object',
    UnsupportedSemaArrayPreset = 'semantic.unsupported-sema-array-preset',
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

    readonly tags?: readonly ProblemTag[];

    readonly relatedLocations?: readonly SemanticDiagnosticRelatedLocation[];
}
