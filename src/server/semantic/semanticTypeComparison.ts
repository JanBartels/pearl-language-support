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
                        && parameter.assignmentProtected === other.assignmentProtected
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
 * IDENT binds an actual object to a formal object. An ordinary formal needs
 * the same type (no widening). A virtual array formal describes the rank and
 * element type, but deliberately imposes no concrete index bounds.
 *
 * DATION without a direction qualifier is a documented RTOS-UH wildcard for
 * IN/OUT/INOUT, not an unresolved or unknown type (section 5.7.10).
 *
 * The caller resolves top-level TYPE aliases. Nested Named types retain their
 * identity as in semanticTypeEquals; no broad structural coercion is added.
 */
export function isIdentificationTypeCompatible(
    formal: SemanticType,
    actual: SemanticType,
    lengths: SimpleTypeLengths = RTOS_UH_DEFAULT_TYPE_LENGTHS
): boolean {
    if (formal.kind === SemanticTypeKind.VirtualArray) {
        if (actual.kind !== SemanticTypeKind.Array
            && actual.kind !== SemanticTypeKind.VirtualArray) return false;
        const actualRank = actual.kind === SemanticTypeKind.Array
            ? actual.dimensions.length : actual.rank;
        return formal.rank === actualRank
            && semanticTypeEquals(formal.elementType, actual.elementType, lengths);
    }
    if (formal.kind === SemanticTypeKind.Dation && actual.kind === SemanticTypeKind.Dation) {
        return formal.dationClass === actual.dationClass
            && (formal.direction === undefined || formal.direction === actual.direction);
    }
    return semanticTypeEquals(formal, actual, lengths);
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
 * A reference-valued result or value parameter can receive either a reference
 * value or the address of an object. Unlike a value transfer, it must never
 * implicitly dereference a reference actual.
 *
 * An unknown object category/protection is not a license to report an error:
 * the caller may still be processing a syntactically valid but unresolved name.
 * Identical rules are used for REF value parameters and RETURNS(REF ...).
 */
export function isReferenceTransferCompatible(
    target: SemanticType,
    source: SemanticType,
    object: { readonly category: 'object' | 'value' | 'unknown';
        readonly assignmentProtected: boolean | undefined },
    lengths: SimpleTypeLengths = RTOS_UH_DEFAULT_TYPE_LENGTHS
): boolean | undefined {
    if (target.kind !== SemanticTypeKind.Reference
        && target.kind !== SemanticTypeKind.VoidReference) return false;
    if (source.kind === SemanticTypeKind.Reference
        || source.kind === SemanticTypeKind.VoidReference) {
        return isTypeAssignable(target, source, lengths);
    }
    if (object.category === 'unknown'
        || (object.category === 'object' && object.assignmentProtected === undefined)) {
        return undefined;
    }
    if (object.category !== 'object' || object.assignmentProtected === undefined) return false;
    return isTypeAssignable(target, {
        kind: SemanticTypeKind.Reference,
        target: source,
        targetInvariant: object.assignmentProtected
    }, lengths);
}

/** Resolve aliases at a REF boundary, without recursively flattening STRUCTs. */
export function resolveReferenceTransferType(
    type: SemanticType,
    resolveType: (type: SemanticType) => SemanticType | undefined
): SemanticType | undefined {
    const resolved = resolveType(type);
    if (!resolved || resolved.kind !== SemanticTypeKind.Reference) return resolved;
    const target = resolveType(resolved.target);
    return target ? { ...resolved, target } : undefined;
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

/**
 * Compatibility of a value transfer (as opposed to IDENT or REF assignment).
 * A non-REF formal parameter receives a copy of the actual value. A typed
 * REF actual is implicitly dereferenced in this context (RTOS-UH 5.6.2.3).
 *
 * Undefined deliberately means that this combination cannot yet be checked:
 * notably a VOID reference with an unknown target, or a virtual array whose
 * by-value rules are not implemented. The caller must not turn those cases
 * into speculative diagnostics. Top-level TYPE aliases must be resolved by
 * the caller; no AST type information is rewritten here.
 */
export function isValueTransferCompatible(
    target: SemanticType,
    source: SemanticType,
    lengths: SimpleTypeLengths = RTOS_UH_DEFAULT_TYPE_LENGTHS
): boolean | undefined {
    // REF destinations require address/reference compatibility, not a copy
    // of the referenced value. Preserve this even if the source is a REF.
    if (target.kind === SemanticTypeKind.Reference || target.kind === SemanticTypeKind.VoidReference)
        return undefined;
    if (source.kind === SemanticTypeKind.VoidReference) return undefined;
    // One automatic dereference is justified by the value context. Further
    // REF levels must not be silently peeled off without their own rules.
    if (source.kind === SemanticTypeKind.Reference) {
        if (source.target.kind === SemanticTypeKind.Reference
            || source.target.kind === SemanticTypeKind.VoidReference) return undefined;
        return isValueTransferCompatible(target, source.target, lengths);
    }
    if (isSimpleValueType(target) || isSimpleValueType(source)) {
        if (!isSimpleValueType(target) || !isSimpleValueType(source)) return false;
        return isScalarValueAssignable(target, source, lengths);
    }
    // Structures can be passed by value, but without scalar widening inside
    // their components (PEARL 90 sections 6.3.2 and 8.2).
    if (target.kind === SemanticTypeKind.Struct || source.kind === SemanticTypeKind.Struct) {
        if (target.kind !== SemanticTypeKind.Struct || source.kind !== SemanticTypeKind.Struct)
            return false;
        return semanticTypeEquals(target, source, lengths);
    }
    return undefined;
}

function isSimpleValueType(type: SemanticType): boolean {
    return type.kind === SemanticTypeKind.Fixed || type.kind === SemanticTypeKind.Float
        || type.kind === SemanticTypeKind.Bit || type.kind === SemanticTypeKind.Character
        || type.kind === SemanticTypeKind.Clock || type.kind === SemanticTypeKind.Duration;
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
