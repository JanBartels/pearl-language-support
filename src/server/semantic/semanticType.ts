// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { SourceValue } from '../core/sourceValue';

import type { TypeSymbol } from './symbol';


export enum SemanticTypeKind {
    Fixed,
    Float,
    Bit,
    Character,
    Clock,
    Duration,
    Sema,
    Bolt,
    Array,
    Struct,
    Reference,
    Named,
    VoidReference,
}


export interface FixedType {

    readonly kind: SemanticTypeKind.Fixed;

    readonly precision: number | undefined;
}


export interface FloatType {

    readonly kind: SemanticTypeKind.Float;

    readonly precision: number | undefined;
}


export interface BitType {

    readonly kind: SemanticTypeKind.Bit;

    readonly length: number | undefined;
}


export interface CharacterType {

    readonly kind: SemanticTypeKind.Character;

    readonly length: number | undefined;
}


export interface ClockType {

    readonly kind: SemanticTypeKind.Clock;
}


export interface DurationType {

    readonly kind: SemanticTypeKind.Duration;
}


export interface SemaType {

    readonly kind: SemanticTypeKind.Sema;
}


export interface BoltType {

    readonly kind: SemanticTypeKind.Bolt;
}


export interface ArrayType {

    readonly kind: SemanticTypeKind.Array;

    readonly elementType: SemanticType;

    readonly dimensions: readonly ArrayDimension[];
}


export interface ArrayDimension {

    readonly lowerBound: bigint;

    readonly upperBound: bigint;
}


export interface StructType {

    readonly kind: SemanticTypeKind.Struct;

    readonly components: readonly StructComponentType[];
}


export interface StructComponentType {

    readonly name: SourceValue<string>;

    readonly type: SemanticType;
}


export interface ReferenceType {

    readonly kind: SemanticTypeKind.Reference;

    readonly target: SemanticType;
}


export interface NamedType {

    readonly kind: SemanticTypeKind.Named;

    readonly symbol: TypeSymbol;
}


export interface VoidReferenceType {

    readonly kind: SemanticTypeKind.VoidReference;
}


export type SemanticType =
    | FixedType
    | FloatType
    | BitType
    | CharacterType
    | ClockType
    | DurationType
    | SemaType
    | BoltType
    | ArrayType
    | StructType
    | ReferenceType
    | NamedType
    | VoidReferenceType
    ;
