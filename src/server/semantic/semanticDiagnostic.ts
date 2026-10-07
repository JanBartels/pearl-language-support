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
