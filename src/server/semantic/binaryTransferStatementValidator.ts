// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { SourceValue } from '../core/sourceValue';
import type { BinaryTransferStatementNode } from '../ast/problem/statements/binaryTransferStatementNode';
import { IoSegmentNode } from '../ast/problem/statements/ioSegmentNode';
import type { ExpressionNode } from '../ast/problem/expressions/expressionNode';
import type { Environment } from './environment';
import type { ExpressionTypeResolver } from './expressionTypeResolver';
import { classifyObjectExpressionInfo, expressionSource } from './expressionObject';
import { dationSupportsDirection } from './dationCapabilities';
import { SemanticDiagnosticCode, SemanticDiagnosticSeverity } from './semanticDiagnostic';
import type { SemanticDiagnostic } from './semanticDiagnostic';
import type { SemanticType } from './semanticType';
import { SemanticTypeKind } from './semanticType';

export interface BinaryTransferValidationContext {
    readonly expressionTypeResolver: ExpressionTypeResolver;
    readonly diagnostics: SemanticDiagnostic[];
    resolveUnderlyingType(type: SemanticType): SemanticType | undefined;
    tryEvaluateFixedExpression(expression: ExpressionNode, environment: Environment): bigint | undefined;
    recordExpressionType(expression: ExpressionNode, type: SemanticType): void;
}

/** Semantic constraints for RTOS-UH's unformatted READ/WRITE and BY S(...).
 *
 * The manual explicitly shows binary READ/WRITE on an ALPHIC DATION (5.7.5).
 * Consequently, requiring class ALL here would incorrectly reject valid UH code.
 * General PEARL positioning formats are not implemented in UH's READ/WRITE
 * (5.7.5); S(...) is implemented from compiler version 15.9-M (5.7.6).
 */
export class BinaryTransferStatementValidator {
    validate(node: BinaryTransferStatementNode, env: Environment,
        state: BinaryTransferValidationContext): void {
        const read = node.keyword.value === 'READ';
        const direction = read ? 'IN' : 'OUT';
        if (node.dation) {
            const type = state.expressionTypeResolver.resolve(node.dation, env);
            const underlying = type && state.resolveUnderlyingType(type);
            const target = underlying?.kind === SemanticTypeKind.Reference
                ? state.resolveUnderlyingType(underlying.target) : underlying;
            const source = expressionSource(node.dation) ?? node.directionKeyword ?? node.keyword;
            if (target && target.kind !== SemanticTypeKind.Dation) {
                this.report(state, SemanticDiagnosticCode.InvalidBinaryTransferDation,
                    source, `${node.keyword.value} erwartet eine DATION oder REF DATION.`);
            } else if (target?.kind === SemanticTypeKind.Dation
                && !dationSupportsDirection(target, direction)) {
                this.report(state, SemanticDiagnosticCode.InvalidBinaryTransferDirection,
                    source, `${node.keyword.value} benötigt eine DATION mit Richtung ${direction} oder INOUT.`);
            }
        }

        for (const object of node.objects) {
            const type = object instanceof IoSegmentNode
                ? this.validateSegment(object, env, state)
                : state.expressionTypeResolver.resolve(object, env);
            if (!read) continue;
            const target = object instanceof IoSegmentNode ? object.array : object;
            const info = classifyObjectExpressionInfo(target, env,
                candidate => state.resolveUnderlyingType(candidate));
            // Unknown symbols already have their own diagnostic. A known
            // procedure without a result is a value, never a READ target.
            if (info.category === 'value' || (type
                && (info.category !== 'object' || info.assignmentProtected === true))) {
                this.report(state, SemanticDiagnosticCode.InvalidBinaryReadTarget,
                    expressionSource(target) ?? node.keyword,
                    'READ erwartet eine beschreibbare Variable (auch Feld oder Struktur).');
            }
        }

        // Unlike formatted GET/PUT, S controls correspond to objects by their
        // ordinal position. Extra S entries are ignored; missing S entries mean
        // that the corresponding objects are transferred without a byte limit.
        for (const format of node.formats) {
            if (!format.variable) continue;
            const type = state.expressionTypeResolver.resolve(format.variable, env);
            const underlying = type && state.resolveUnderlyingType(type);
            if (!underlying) continue; // Shared name resolution already diagnoses unknown names.
            const info = classifyObjectExpressionInfo(format.variable, env,
                candidate => state.resolveUnderlyingType(candidate));
            if (underlying.kind !== SemanticTypeKind.Fixed || underlying.precision !== 31
                || info.category !== 'object' || info.assignmentProtected !== false) {
                this.report(state, SemanticDiagnosticCode.InvalidBinaryTransferSFormat,
                    expressionSource(format.variable) ?? format.keyword,
                    'S(...) erwartet eine beschreibbare FIXED(31)-Variable.');
            }
        }
    }

    private validateSegment(segment: IoSegmentNode, env: Environment,
        state: BinaryTransferValidationContext): SemanticType | undefined {
        const initial = state.expressionTypeResolver.resolve(segment.array, env);
        const base = initial && state.resolveUnderlyingType(initial);
        const actual = base?.kind === SemanticTypeKind.Reference
            ? state.resolveUnderlyingType(base.target) : base;
        const source = segment.array.segments[0]?.identifier;
        if (actual && actual.kind !== SemanticTypeKind.Array
            && actual.kind !== SemanticTypeKind.VirtualArray && source) {
            this.report(state, SemanticDiagnosticCode.InvalidIoSegment,
                source, 'Ein E/A-Ausschnitt erfordert ein Feld.');
        }
        if (actual?.kind === SemanticTypeKind.Array || actual?.kind === SemanticTypeKind.VirtualArray) {
            const dimensions = actual.kind === SemanticTypeKind.Array
                ? actual.dimensions.length : actual.rank;
            if (segment.leadingIndices.length + 1 !== dimensions && source) {
                this.report(state, SemanticDiagnosticCode.InvalidIoSegment,
                    source, 'Im E/A-Ausschnitt muss der Bereich in der letzten Felddimension liegen.');
            }
        }
        for (const index of [...segment.leadingIndices, segment.lower, segment.upper]) {
            if (!index) continue;
            const type = state.expressionTypeResolver.resolve(index, env);
            const resolved = type && state.resolveUnderlyingType(type);
            if (resolved && resolved.kind !== SemanticTypeKind.Fixed) {
                this.report(state, SemanticDiagnosticCode.InvalidIoSegment,
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
                    this.report(state, SemanticDiagnosticCode.InvalidIoSegment,
                        expressionSource(value) ?? segment.opening,
                        'Konstanter E/A-Ausschnittindex liegt außerhalb der Feldgrenzen.');
                }
            }
            if (segment.lower && segment.upper) {
                const low = state.tryEvaluateFixedExpression(segment.lower, env);
                const high = state.tryEvaluateFixedExpression(segment.upper, env);
                if (low !== undefined && high !== undefined && low > high) {
                    this.report(state, SemanticDiagnosticCode.InvalidIoSegment,
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

    private report(state: BinaryTransferValidationContext, code: SemanticDiagnosticCode,
        source: SourceValue<string>, message: string): void {
        if (!source.location) return;
        state.diagnostics.push({ code, severity: SemanticDiagnosticSeverity.Error,
            location: source.location, message });
    }
}
