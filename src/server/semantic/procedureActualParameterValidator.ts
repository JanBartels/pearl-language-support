// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { SourceValue } from '../core/sourceValue';
import type { ExpressionNode } from '../ast/problem/expressions/expressionNode';
import { AstKind } from '../ast/astKind';
import { LiteralExpressionNode } from '../ast/problem/expressions/literalExpressionNode';
import { ParenthesizedExpressionNode } from '../ast/problem/expressions/parenthesizedExpressionNode';
import type { Environment } from './environment';
import { classifyObjectExpression, classifyObjectExpressionInfo, expressionSource } from './expressionObject';
import type { BuiltinSignature } from './builtins/builtinSignature';
import type { ProcedureType, SemanticType } from './semanticType';
import { SemanticTypeKind } from './semanticType';
import { isIdentificationTypeCompatible, isNilAssignableTo, isReferenceTransferCompatible, isTypeAssignable, isValueTransferCompatible, resolveReferenceTransferType, semanticTypeEquals } from './semanticTypeComparison';

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
}

/** Identical argument rules for expression calls and CALL statements.
 * IDENT requires an object of the exact type; REF IDENT additionally
 * requires an actual reference variable. REF by value accepts a compatible
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
        if (!actual) {
            valid = false;
            continue;
        }
        const received = resolveReferenceTransferType(actual, type => context.resolveUnderlyingType(type));
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
                } else if (!semanticTypeEquals(expected, received)) {
                    context.reportInvalidFunctionArgumentType(source, target, index + 1,
                        formal.type, actual);
                    valid = false;
                }
            } else {
                const compatible = isReferenceTransferCompatible(expected, received, object);
                if (compatible === false) {
                    context.reportInvalidFunctionArgumentType(source, target, index + 1,
                        formal.type, actual);
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
                    formal.type, actual);
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
                formal.type, actual);
            valid = false;
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

function isReferenceType(type: SemanticType): boolean {
    return type.kind === SemanticTypeKind.Reference || type.kind === SemanticTypeKind.VoidReference;
}

function isNilExpression(expression: ExpressionNode): boolean {
    let current: ExpressionNode | undefined = expression;
    while (current?.kind === AstKind.ParenthesizedExpression) {
        current = (current as ParenthesizedExpressionNode).expression;
    }
    return current?.kind === AstKind.LiteralExpression
        && (current as LiteralExpressionNode).literal.value === 'NIL';
}

