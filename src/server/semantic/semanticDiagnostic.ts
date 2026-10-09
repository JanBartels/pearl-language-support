// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { Location } from '../core/location';


export enum SemanticDiagnosticSeverity {
    Error,
    Warning,
}


export enum SemanticDiagnosticCode {
    UnknownType = 'semantic.unknown-type',
    ExpectedType = 'semantic.expected-type',
    DuplicateType = 'semantic.duplicate-type',
    DuplicateDeclaration = 'semantic.duplicate-declaration',
    SpecificationMismatch = 'semantic.specification-mismatch',
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
    UnknownCompilerMode = 'semantic.unknown-compiler-mode',
    MarkerOptionWithoutNoLineStop = 'semantic.marker-option-without-nolstop',
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
