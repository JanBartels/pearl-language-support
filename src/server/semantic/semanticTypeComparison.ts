// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SemanticTypeKind } from './semanticType';
import type { ProcedureType, SemanticType } from './semanticType';

/**
 * Effective default lengths in RTOS-UH/PEARL 90 (manual section 5.1).
 * LENGTH declarations can override these defaults. The caller must pass the
 * effective lengths once LENGTH is represented by the semantic environment.
 */
export interface SimpleTypeLengths {
    readonly fixed: number;
    readonly float: number;
    readonly bit: number;
    readonly character: number;
}

export const RTOS_UH_DEFAULT_TYPE_LENGTHS: SimpleTypeLengths = {
    fixed: 15,
    float: 23,
    bit: 1,
    character: 1
};

/**
 * Semantic normalization, leaving the syntax tree and original type spelling
 * untouched. In particular, REF STRUCT[] stays a distinct VOID-reference.
 * Named types retain their symbol identity and are not unfolded here.
 */
export function canonicalizeSemanticType(
    type: SemanticType,
    lengths: SimpleTypeLengths = RTOS_UH_DEFAULT_TYPE_LENGTHS
): SemanticType {
    switch (type.kind) {
        case SemanticTypeKind.Fixed:
            return { kind: type.kind, precision: type.precision ?? lengths.fixed };
        case SemanticTypeKind.Float:
            return { kind: type.kind, precision: type.precision ?? lengths.float };
        case SemanticTypeKind.Bit:
            return { kind: type.kind, length: type.length ?? lengths.bit };
        case SemanticTypeKind.Character:
            return { kind: type.kind, length: type.length ?? lengths.character };
        case SemanticTypeKind.Array:
            return { ...type, elementType: canonicalizeSemanticType(type.elementType, lengths) };
        case SemanticTypeKind.VirtualArray:
            return { ...type, elementType: canonicalizeSemanticType(type.elementType, lengths) };
        case SemanticTypeKind.Struct:
            return { ...type, components: type.components.map(component => ({
                ...component, type: canonicalizeSemanticType(component.type, lengths)
            })) };
        case SemanticTypeKind.Reference:
            return { ...type, target: canonicalizeSemanticType(type.target, lengths) };
        case SemanticTypeKind.Procedure:
            return {
                ...type,
                parameters: type.parameters.map(parameter => ({
                    ...parameter,
                    type: parameter.type
                        ? canonicalizeSemanticType(parameter.type, lengths)
                        : undefined
                })),
                resultType: type.resultType
                    ? canonicalizeSemanticType(type.resultType, lengths)
                    : undefined
            };
        default:
            return type;
    }
}

/** Exact semantic type identity. No VOID wildcard and no NIL pseudo-type. */
export function semanticTypeEquals(
    left: SemanticType,
    right: SemanticType,
    lengths: SimpleTypeLengths = RTOS_UH_DEFAULT_TYPE_LENGTHS
): boolean {
    return identical(
        canonicalizeSemanticType(left, lengths),
        canonicalizeSemanticType(right, lengths)
    );
}

function identical(left: SemanticType, right: SemanticType): boolean {
    if (left.kind !== right.kind) return false;
    switch (left.kind) {
        case SemanticTypeKind.Fixed:
            return right.kind === SemanticTypeKind.Fixed && left.precision === right.precision;
        case SemanticTypeKind.Float:
            return right.kind === SemanticTypeKind.Float && left.precision === right.precision;
        case SemanticTypeKind.Bit:
            return right.kind === SemanticTypeKind.Bit && left.length === right.length;
        case SemanticTypeKind.Character:
            return right.kind === SemanticTypeKind.Character && left.length === right.length;
        case SemanticTypeKind.Clock:
        case SemanticTypeKind.Duration:
        case SemanticTypeKind.Sema:
        case SemanticTypeKind.Bolt:
        case SemanticTypeKind.Interrupt:
        case SemanticTypeKind.Task:
            return true;
        case SemanticTypeKind.VoidReference:
            return right.kind === SemanticTypeKind.VoidReference
                && left.targetInvariant === right.targetInvariant;
        case SemanticTypeKind.Dation:
            return right.kind === SemanticTypeKind.Dation
                && left.direction === right.direction
                && left.dationClass === right.dationClass;
        case SemanticTypeKind.Array:
            return right.kind === SemanticTypeKind.Array
                && left.dimensions.length === right.dimensions.length
                && left.dimensions.every((dimension, index) =>
                    dimension.lowerBound === right.dimensions[index].lowerBound
                    && dimension.upperBound === right.dimensions[index].upperBound)
                && identical(left.elementType, right.elementType);
        case SemanticTypeKind.VirtualArray:
            return right.kind === SemanticTypeKind.VirtualArray
                && left.rank === right.rank
                && identical(left.elementType, right.elementType);
        case SemanticTypeKind.Struct:
            return right.kind === SemanticTypeKind.Struct
                && left.components.length === right.components.length
                && left.components.every((component, index) =>
                    component.name.value === right.components[index].name.value
                    && identical(component.type, right.components[index].type));
        case SemanticTypeKind.Reference:
            return right.kind === SemanticTypeKind.Reference
                && left.targetInvariant === right.targetInvariant
                && identical(left.target, right.target);
        case SemanticTypeKind.Procedure:
            return right.kind === SemanticTypeKind.Procedure
                && left.callingConvention === right.callingConvention
                && left.hasResult === right.hasResult
                && left.parameters.length === right.parameters.length
                && left.parameters.every((parameter, index) => {
                    const other = right.parameters[index];
                    // Missing types mean unresolved semantics, not a wildcard.
                    return parameter.byIdentification === other.byIdentification
                        && parameter.type !== undefined
                        && other.type !== undefined
                        && identical(parameter.type, other.type);
                })
                && (!left.hasResult || (left.resultType !== undefined
                    && right.resultType !== undefined
                    && identical(left.resultType, right.resultType)));
        case SemanticTypeKind.Named:
            return right.kind === SemanticTypeKind.Named && left.symbol === right.symbol;
    }
}

/**
 * Type compatibility for assigning an already typed REF value. This is
 * deliberately directional: a typed reference can be stored in a VOID REF,
 * but a VOID REF is not considered identical to a typed reference.
 * NIL is not a type and is handled separately by isNilAssignableTo().
 */
export function isTypeAssignable(
    target: SemanticType,
    source: SemanticType,
    lengths: SimpleTypeLengths = RTOS_UH_DEFAULT_TYPE_LENGTHS
): boolean {
    if (semanticTypeEquals(target, source, lengths)) return true;

    // A read-only reference can point to a writable object, but never vice versa.
    if (target.kind === SemanticTypeKind.Reference
        && source.kind === SemanticTypeKind.Reference) {
        return target.targetInvariant && !source.targetInvariant
            && semanticTypeEquals(target.target, source.target, lengths);
    }

    // VOID references accept arbitrary referenced types while preserving INV.
    if (target.kind === SemanticTypeKind.VoidReference
        && (source.kind === SemanticTypeKind.Reference
            || source.kind === SemanticTypeKind.VoidReference)) {
        return target.targetInvariant || !source.targetInvariant;
    }

    return false;
}

/**
 * Value transfer uses the same scalar widening rules as an assignment.
 * This is deliberately distinct from exact type identity and from REF
 * compatibility; callers must resolve TYPE aliases and handle reference
 * dereferencing and IDENT parameters separately.
 *
 * Default lengths are effective only for this comparison. Neither original
 * SemanticType nor the syntax tree is modified.
 */
export function isScalarValueAssignable(
    target: SemanticType,
    source: SemanticType,
    lengths: SimpleTypeLengths = RTOS_UH_DEFAULT_TYPE_LENGTHS
): boolean {
    const to = canonicalizeSemanticType(target, lengths);
    const from = canonicalizeSemanticType(source, lengths);
    if (to.kind === SemanticTypeKind.Fixed && from.kind === SemanticTypeKind.Fixed) {
        return to.precision! >= from.precision!;
    }
    if (to.kind === SemanticTypeKind.Float &&
        (from.kind === SemanticTypeKind.Fixed || from.kind === SemanticTypeKind.Float)) {
        return to.precision! >= from.precision!;
    }
    if (to.kind === SemanticTypeKind.Bit && from.kind === SemanticTypeKind.Bit
        || to.kind === SemanticTypeKind.Character && from.kind === SemanticTypeKind.Character) {
        return to.length! >= from.length!;
    }
    return semanticTypeEquals(target, source, lengths);
}

/** NIL is compatible with reference destinations, but not with scalar types. */
export function isNilAssignableTo(type: SemanticType): boolean {
    return type.kind === SemanticTypeKind.Reference
        || type.kind === SemanticTypeKind.VoidReference;
}

/**
 * A signature with unresolved types cannot yet be compared as a complete
 * interface. Leave its primary unknown-type diagnostic to the resolver
 * rather than producing a misleading secondary SPC/PROC mismatch.
 */
export function isProcedureSignatureResolved(signature: ProcedureType): boolean {
    return signature.parameters.every(parameter => parameter.type !== undefined
        && isTypeResolved(parameter.type))
        && (!signature.hasResult || (signature.resultType !== undefined
            && isTypeResolved(signature.resultType)));
}

function isTypeResolved(type: SemanticType): boolean {
    switch (type.kind) {
        case SemanticTypeKind.Array:
        case SemanticTypeKind.VirtualArray:
            return isTypeResolved(type.elementType);
        case SemanticTypeKind.Struct:
            return type.components.every(component => isTypeResolved(component.type));
        case SemanticTypeKind.Reference:
            return isTypeResolved(type.target);
        case SemanticTypeKind.Procedure:
            return isProcedureSignatureResolved(type);
        default:
            return true;
    }
}

/** Explicit alias to make signature checks easy to locate in the call sites. */
export function procedureSignaturesEqual(
    specification: ProcedureType,
    definition: ProcedureType,
    lengths: SimpleTypeLengths = RTOS_UH_DEFAULT_TYPE_LENGTHS
): boolean {
    return semanticTypeEquals(specification, definition, lengths);
}
