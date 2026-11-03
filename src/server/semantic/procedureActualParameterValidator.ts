// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { SourceValue } from '../core/sourceValue';
import type { ExpressionNode } from '../ast/problem/expressions/expressionNode';
import { AstKind } from '../ast/astKind';
import { LiteralExpressionNode } from '../ast/problem/expressions/literalExpressionNode';
import { ParenthesizedExpressionNode } from '../ast/problem/expressions/parenthesizedExpressionNode';
import type { Environment } from './environment';
import { procedureAddressType } from './procedureAddressType';
import { classifyObjectExpression, classifyObjectExpressionInfo, expressionSource } from './expressionObject';
import type { BuiltinSignature } from './builtins/builtinSignature';
import type { ProcedureType, ReferenceType, VoidReferenceType, SemanticType } from './semanticType';
import { SemanticTypeKind } from './semanticType';
import { characterTruncationForValueTransfer, isIdentificationTypeCompatible, isNilAssignableTo, isReferenceTransferCompatible, isTypeAssignable, isValueTransferCompatible, resolveReferenceTransferType, semanticTypeEquals } from './semanticTypeComparison';

export type CharacterTransferDiagnosticContext =
    | { readonly kind: 'assignment' | 'return' }
    | { readonly kind: 'argument'; readonly target: SourceValue<string>; readonly position: number };

export interface ProcedureActualParameterValidationContext {
    resolveUnderlyingType(type: SemanticType): SemanticType | undefined;
    /** Receives declared types, preserving TYPE aliases for diagnostics;
     * validation itself uses resolved types. */
    reportInvalidFunctionArgumentType(
        source: SourceValue<string>, target: SourceValue<string>, position: number,
        expected: SemanticType, actual: SemanticType
    ): void;
    reportInvalidIdentificationArgument(source: SourceValue<string>, target: SourceValue<string>,
        position: number, formalName?: string, reason?: 'protected'): void;
    reportReferenceTargetProtectionLoss(
        source: SourceValue<string>, target: SourceValue<string>, position: number): void;
    reportMutableReferenceToCharacterLiteral(
        source: SourceValue<string>, target: SourceValue<string>, position: number): void;
    reportCharacterTruncation(source: SourceValue<string>, targetLength: number,
        sourceLength: number, context: CharacterTransferDiagnosticContext): void;
}

/** Identical argument rules for expression calls and CALL statements.
 * IDENT requires an object of the exact type; REF IDENT additionally
 * requires an actual reference variable. The writable VOID REF formal
 * (REF STRUCT[] IDENT) accepts compatible typed reference variables. REF by value accepts a compatible
 * reference or the address of a suitable object (RTOS-UH 5.6.2.6).
 * Non-IDENT scalars and structures are checked as value transfers, including
 * automatic dereferencing of typed REF actuals in non-REF contexts.
 */
export function validateProcedureActualParameters(
    target: SourceValue<string>, signature: ProcedureType,
    expressions: readonly (ExpressionNode | undefined)[],
    types: readonly (SemanticType | undefined)[],
    environment: Environment, context: ProcedureActualParameterValidationContext
): boolean {
    let valid = true;
    for (let index = 0; index < signature.parameters.length; index++) {
        const formal = signature.parameters[index];
        const expression = expressions[index];
        const actual = types[index];
        if (!expression || !formal.type) {
            valid = false;
            continue;
        }
        // A literal or a computed value cannot satisfy IDENT even if it has
        // no standalone type (NIL). Avoid duplicating type errors for names
        // that have not yet been resolved.
        if (formal.byIdentification && classifyObjectExpression(expression, environment,
            type => context.resolveUnderlyingType(type)) === 'value') {
            context.reportInvalidIdentificationArgument(expressionSource(expression) ?? target,
                target, index + 1);
            valid = false;
            continue;
        }
        const expected = resolveReferenceTransferType(formal.type, type => context.resolveUnderlyingType(type));
        if (!expected) {
            valid = false;
            continue;
        }
        const source = expressionSource(expression) ?? target;
        // NIL has no SemanticType. It is a reference value per value, but
        // cannot identify a reference variable (or an ordinary object).
        if (isNilExpression(expression)) {
            if (isNilAssignableTo(expected) && !formal.byIdentification) continue;
            if (!formal.byIdentification) {
                // Unrelated NIL type errors are currently reported by other
                // consumers (e.g. RETURN). Avoid an invented NIL type here.
                valid = false;
            }
            continue;
        }
        // For a REF PROC formal, a bare procedure name is a procedure
        // address, not the return value of an implicit function call.
        const address = expected.kind === SemanticTypeKind.Reference
            && expected.target.kind === SemanticTypeKind.Procedure
            ? procedureAddressType(expression, environment) : undefined;
        const contextualActual = address ?? actual;
        if (!contextualActual) {
            valid = false;
            continue;
        }
        const received = resolveReferenceTransferType(contextualActual,
            type => context.resolveUnderlyingType(type));
        if (!received) {
            valid = false;
            continue;
        }
        if (formal.byIdentification && !formal.assignmentProtected) {
            const object = classifyObjectExpressionInfo(expression, environment,
                type => context.resolveUnderlyingType(type));
            // A non-REF IDENT formal identifies the *target* of a REF actual.
            // INV REF only protects the pointer variable; REF INV protects the
            // identified object. For a REF IDENT formal, on the other hand, the
            // pointer variable itself is identified and its INV flag applies.
            const protectedObject = !isReferenceType(expected)
                && received.kind === SemanticTypeKind.Reference
                ? received.targetInvariant : object.assignmentProtected;
            if (object.category === 'object' && protectedObject === true) {
                context.reportInvalidIdentificationArgument(source, target, index + 1,
                    undefined, 'protected');
                valid = false;
                continue;
            }
        }
        if (isReferenceType(expected)) {
            const object = classifyObjectExpressionInfo(expression, environment,
                type => context.resolveUnderlyingType(type));
            if (formal.byIdentification) {
                // REF IDENT passes the pointer variable, not just an address.
                if (object.category === 'unknown') continue;
                if (object.category !== 'object' || !isReferenceType(received)) {
                    context.reportInvalidIdentificationArgument(source, target, index + 1);
                    valid = false;
                } else {
                    // The UH compiler also accepts REF INV through the generic
                    // writable VOID REF IDENT formal. This loses the protection
                    // guarantee: report a warning, not a speculative error.
                    // All typed REF IDENT formals retain exact comparison.
                    const genericWritable = expected.kind === SemanticTypeKind.VoidReference
                        && !expected.targetInvariant;
                    const losesProtection = genericWritable && received.targetInvariant;
                    const compatible = genericWritable
                        ? isTypeAssignable(expected, received) || losesProtection
                        : semanticTypeEquals(expected, received);
                    if (!compatible) {
                        context.reportInvalidFunctionArgumentType(source, target, index + 1,
                            formal.type, contextualActual);
                        valid = false;
                    } else if (losesProtection) {
                        context.reportReferenceTargetProtectionLoss(source, target, index + 1);
                    }
                }
            } else {
                // UH-PEARL can pass a character literal's stable storage
                // address to a generic REF parameter. Do not infer this for
                // numeric constants or arbitrary computed expressions.
                if (expected.kind === SemanticTypeKind.VoidReference
                    && received.kind === SemanticTypeKind.Character
                    && isCharacterLiteralExpression(expression)) {
                    // The UH compiler allows an address of CHARACTER literal
                    // storage in generic REF by-value parameters. A writable
                    // formal can nevertheless let the callee modify that storage.
                    if (!expected.targetInvariant) {
                        context.reportMutableReferenceToCharacterLiteral(source, target, index + 1);
                    }
                    continue;
                }
                const compatible = isReferenceTransferCompatible(expected, received, object);
                if (compatible === false) {
                    context.reportInvalidFunctionArgumentType(source, target, index + 1,
                        formal.type, contextualActual);
                    valid = false;
                }
            }
            continue;
        }
        if (formal.byIdentification) {
            const objectClass = classifyObjectExpression(expression, environment,
                type => context.resolveUnderlyingType(type));
            if (objectClass === 'unknown') continue;
            // A typed REF actual identifies its target for a non-REF IDENT
            // formal. Check that target just like a directly named object;
            // do not silently accept a reference to an unrelated type.
            // A VOID reference has no known target type and cannot establish
            // exact IDENT compatibility.
            const identifiedType = received.kind === SemanticTypeKind.Reference
                ? received.target : received;
            if (!isIdentificationTypeCompatible(expected, identifiedType)) {
                context.reportInvalidFunctionArgumentType(source, target, index + 1,
                    formal.type, contextualActual);
                valid = false;
            }
            continue;
        }
        // For non-REF formals, a typed REF actual is dereferenced to its
        // target *value*. REF formals were checked above without dereference.
        // We keep the original actual type in the diagnostic, which is useful
        // when the implicit conversion itself is incompatible.
        const compatibility = isValueTransferCompatible(expected, received);
        if (compatibility === false) {
            context.reportInvalidFunctionArgumentType(source, target, index + 1,
                formal.type, contextualActual);
            valid = false;
        } else if (compatibility === true) {
            const truncation = characterTruncationForValueTransfer(expected, received);
            if (truncation) {
                context.reportCharacterTruncation(source, truncation.targetLength,
                    truncation.sourceLength, { kind: 'argument', target, position: index + 1 });
            }
        }
    }
    return valid;
}

/** Shared built-in IDENT rule for both expression calls and CALL statements.
 * The pattern/signature matcher remains responsible for operand types.
 */
export function validateBuiltinIdentificationParameters(
    target: SourceValue<string>, signature: BuiltinSignature,
    expressions: readonly (ExpressionNode | undefined)[],
    environment: Environment, context: ProcedureActualParameterValidationContext
): boolean {
    let valid = true;
    for (let index = 0; index < expressions.length; index++) {
        const formal = signature.parameters[index] ?? signature.repeatedParameter;
        const actual = expressions[index];
        if (!formal?.byIdentification || !actual) continue;
        const objectClass = classifyObjectExpression(actual, environment,
            type => context.resolveUnderlyingType(type));
        if (objectClass !== 'value') continue;
        context.reportInvalidIdentificationArgument(expressionSource(actual) ?? target,
            target, index + 1, formal.name);
        valid = false;
    }
    return valid;
}

function isReferenceType(type: SemanticType): type is ReferenceType | VoidReferenceType {
    return type.kind === SemanticTypeKind.Reference || type.kind === SemanticTypeKind.VoidReference;
}

function isCharacterLiteralExpression(expression: ExpressionNode): boolean {
    let value: ExpressionNode | undefined = expression;
    while (value?.kind === AstKind.ParenthesizedExpression) {
        value = (value as ParenthesizedExpressionNode).expression;
    }
    return value instanceof LiteralExpressionNode
        && /^'(?:[^']|'')*'$/.test(value.literal.value);
}

function isNilExpression(expression: ExpressionNode): boolean {
    let current: ExpressionNode | undefined = expression;
    while (current?.kind === AstKind.ParenthesizedExpression) {
        current = (current as ParenthesizedExpressionNode).expression;
    }
    return current?.kind === AstKind.LiteralExpression
        && (current as LiteralExpressionNode).literal.value === 'NIL';
}

