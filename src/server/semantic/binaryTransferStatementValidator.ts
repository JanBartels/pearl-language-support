// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { SourceValue } from '../core/sourceValue';
import type { BinaryTransferStatementNode } from '../ast/problem/statements/binaryTransferStatementNode';
import { IoSegmentNode } from '../ast/problem/statements/ioSegmentNode';
import { validateIoSegment, type IoSegmentValidationContext } from './ioSegmentValidator';
import type { ExpressionNode } from '../ast/problem/expressions/expressionNode';
import type { Environment } from './environment';
import type { ExpressionTypeResolver } from './expressionTypeResolver';
import { classifyObjectExpressionInfo, expressionSource } from './expressionObject';
import { dationSupportsDirection } from './dationCapabilities';
import { SemanticDiagnosticCode, SemanticDiagnosticSeverity } from './semanticDiagnostic';
import type { SemanticDiagnostic } from './semanticDiagnostic';
import type { SemanticType } from './semanticType';
import { SemanticTypeKind } from './semanticType';

export interface BinaryTransferValidationContext extends IoSegmentValidationContext {}

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
                ? validateIoSegment(object, env, state)
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

    private report(state: BinaryTransferValidationContext, code: SemanticDiagnosticCode,
        source: SourceValue<string>, message: string): void {
        if (!source.location) return;
        state.diagnostics.push({ code, severity: SemanticDiagnosticSeverity.Error,
            location: source.location, message });
    }
}
