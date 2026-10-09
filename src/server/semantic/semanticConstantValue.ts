// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { DecimalTimeValue } from './decimalTimeValue';
import type { DataObjectSymbol } from './symbol';

export enum SemanticConstantKind {
    Fixed,
    Float,
    Bit,
    Character,
    Clock,
    Duration,
}

export interface FixedConstantValue {
    readonly kind: SemanticConstantKind.Fixed;
    readonly value: bigint;
}

/**
 * FLOAT constants are kept as their exact PEARL decimal spelling for now.
 *
 * Using a JavaScript number here would lose information for FLOAT(55). A later
 * FLOAT evaluator can replace this representation by a dedicated decimal value
 * type without affecting the AST.
 */
export interface FloatConstantValue {
    readonly kind: SemanticConstantKind.Float;
    readonly literal: string;
}

export interface BitConstantValue {
    readonly kind: SemanticConstantKind.Bit;
    readonly bits: string;
}

export interface CharacterConstantValue {
    readonly kind: SemanticConstantKind.Character;
    readonly value: string;
}

export interface ClockConstantValue {
    readonly kind: SemanticConstantKind.Clock;
    readonly secondsSinceMidnight: DecimalTimeValue;
}

export interface DurationConstantValue {
    readonly kind: SemanticConstantKind.Duration;
    readonly seconds: DecimalTimeValue;
}

export type TimeConstantValue =
    | ClockConstantValue
    | DurationConstantValue;

export type SemanticConstantValue =
    | FixedConstantValue
    | FloatConstantValue
    | BitConstantValue
    | CharacterConstantValue
    | ClockConstantValue
    | DurationConstantValue;

export enum SemanticInitialValueKind {
    Constant,
    Reference,
}

/**
 * Effective initialization of one declared data object.
 *
 * For arrays, `values` contains the explicitly contributing prefix for this
 * object. If it is shorter than `elementCount`, PEARL repeats the last value
 * for the remaining elements. This keeps large array initializations compact.
 */
export interface SemanticConstantInitialValue {
    readonly kind: SemanticInitialValueKind.Constant;
    readonly values: readonly SemanticConstantValue[];
    readonly elementCount: bigint;
}

export interface SemanticReferenceInitialValue {
    readonly kind: SemanticInitialValueKind.Reference;
    readonly values: readonly DataObjectSymbol[];
    readonly elementCount: bigint;
}

export type SemanticInitialValue =
    | SemanticConstantInitialValue
    | SemanticReferenceInitialValue;
