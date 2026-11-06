// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { SourceValue } from '../core/sourceValue';
import type { Environment } from './environment';
import type { ExpressionTypeResolver } from './expressionTypeResolver';
import type { ExpressionNode } from '../ast/problem/expressions/expressionNode';
import { IoSegmentNode } from '../ast/problem/statements/ioSegmentNode';
import { SemanticDiagnosticCode, SemanticDiagnosticSeverity } from './semanticDiagnostic';
import type { SemanticDiagnostic } from './semanticDiagnostic';
import type { SemanticType } from './semanticType';
import { SemanticTypeKind } from './semanticType';
import { expressionSource } from './expressionObject';

/** Common field-segment checks, independent of READ/WRITE vs GET/PUT.
 * Format execution and format/data correspondence are not handled here.
 */
export interface IoSegmentValidationContext {
    readonly expressionTypeResolver: ExpressionTypeResolver;
    readonly diagnostics: SemanticDiagnostic[];
    resolveUnderlyingType(type: SemanticType): SemanticType | undefined;
    tryEvaluateFixedExpression(expression: ExpressionNode, environment: Environment): bigint | undefined;
    recordExpressionType(expression: ExpressionNode, type: SemanticType): void;
}

export function validateIoSegment(segment: IoSegmentNode, env: Environment,
    state: IoSegmentValidationContext): SemanticType | undefined {
    const initial = state.expressionTypeResolver.resolve(segment.array, env);
    const base = initial && state.resolveUnderlyingType(initial);
    const actual = base?.kind === SemanticTypeKind.Reference
        ? state.resolveUnderlyingType(base.target) : base;
    const source = segment.array.segments[0]?.identifier;
    if (actual && actual.kind !== SemanticTypeKind.Array
        && actual.kind !== SemanticTypeKind.VirtualArray && source) {
        report(state, SemanticDiagnosticCode.InvalidIoSegment,
            source, 'Ein E/A-Ausschnitt erfordert ein Feld.');
    }
    if (actual?.kind === SemanticTypeKind.Array || actual?.kind === SemanticTypeKind.VirtualArray) {
        const dimensions = actual.kind === SemanticTypeKind.Array
            ? actual.dimensions.length : actual.rank;
        if (segment.leadingIndices.length + 1 !== dimensions && source) {
            report(state, SemanticDiagnosticCode.InvalidIoSegment,
                source, 'Im E/A-Ausschnitt muss der Bereich in der letzten Felddimension liegen.');
        }
    }
    for (const index of [...segment.leadingIndices, segment.lower, segment.upper]) {
        if (!index) continue;
        const type = state.expressionTypeResolver.resolve(index, env);
        const resolved = type && state.resolveUnderlyingType(type);
        if (resolved && resolved.kind !== SemanticTypeKind.Fixed) {
            report(state, SemanticDiagnosticCode.InvalidIoSegment,
                expressionSource(index) ?? segment.colon ?? segment.opening,
                'Indizes eines E/A-Ausschnitts müssen FIXED-Ausdrücke sein.');
        }
    }
    if (actual?.kind === SemanticTypeKind.Array
        && actual.dimensions.length === segment.leadingIndices.length + 1) {
        const values = [...segment.leadingIndices, segment.lower, segment.upper];
        const last = actual.dimensions[actual.dimensions.length - 1];
        for (let index = 0; index < values.length; index++) {
            const value = values[index];
            if (!value) continue;
            const constant = state.tryEvaluateFixedExpression(value, env);
            if (constant === undefined) continue;
            const dimension = index < segment.leadingIndices.length
                ? actual.dimensions[index] : last;
            if (constant < dimension.lowerBound || constant > dimension.upperBound) {
                report(state, SemanticDiagnosticCode.InvalidIoSegment,
                    expressionSource(value) ?? segment.opening,
                    'Konstanter E/A-Ausschnittindex liegt außerhalb der Feldgrenzen.');
            }
        }
        if (segment.lower && segment.upper) {
            const low = state.tryEvaluateFixedExpression(segment.lower, env);
            const high = state.tryEvaluateFixedExpression(segment.upper, env);
            if (low !== undefined && high !== undefined && low > high) {
                report(state, SemanticDiagnosticCode.InvalidIoSegment,
                    expressionSource(segment.lower) ?? segment.colon ?? segment.opening,
                    'Die untere Grenze des E/A-Ausschnitts ist größer als die obere.');
            }
        }
    }
    // A segment uses the element type for transfer; the source array
    // remains a complete expression child for bindings and navigation.
    if (actual?.kind === SemanticTypeKind.Array || actual?.kind === SemanticTypeKind.VirtualArray) {
        state.recordExpressionType(segment, actual.elementType);
        return actual.elementType;
    }
    return undefined;
}

function report(state: IoSegmentValidationContext, code: SemanticDiagnosticCode,
    source: SourceValue<string>, message: string): void {
    if (source.location) state.diagnostics.push({
        code, severity: SemanticDiagnosticSeverity.Error, location: source.location, message
    });
}
