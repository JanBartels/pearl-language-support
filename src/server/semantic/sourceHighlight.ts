// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { SourceValue } from '../core/sourceValue';

/**
 * Compiler-side classification of one physical language element.
 *
 * This is deliberately independent of LSP token names, editor themes,
 * delta encoding and document versions. Classifiers contribute SourceValues
 * that already exist in the syntax/semantic model; they do not re-lex text.
 */
export enum SourceHighlightKind {
    Module,
    Type,
    DataObject,
    Parameter,
    Procedure,
    Task,
    StructComponent,
    Label,
    Macro,
    Keyword,
    Operator,
    StringLiteral,
    NumberLiteral
}

export enum SourceHighlightAttribute {
    Declaration,
    Readonly
}

export interface SourceHighlight {
    readonly element: SourceValue<unknown>;
    readonly kind: SourceHighlightKind;
    readonly attributes?: readonly SourceHighlightAttribute[];
}
