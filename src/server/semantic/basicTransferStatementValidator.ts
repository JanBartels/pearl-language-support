// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { SourceValue } from '../core/sourceValue';
import type { BasicTransferStatementNode } from '../ast/problem/statements/basicTransferStatementNode';
import type { Environment } from './environment';
import type { ExpressionTypeResolver } from './expressionTypeResolver';
import { classifyObjectExpressionInfo, expressionSource } from './expressionObject';
import { dationSupportsDirection } from './dationCapabilities';
import { SemanticDiagnosticCode, SemanticDiagnosticSeverity } from './semanticDiagnostic';
import type { SemanticDiagnostic } from './semanticDiagnostic';
import type { SemanticType } from './semanticType';
import { SemanticTypeKind } from './semanticType';

export interface BasicTransferValidationContext {
    readonly expressionTypeResolver: ExpressionTypeResolver;
    readonly diagnostics: SemanticDiagnostic[];
    resolveUnderlyingType(type: SemanticType): SemanticType | undefined;
}

/** RTOS-UH BASIC-DATION I/O (manual chapter 6.2, original compiler 16.7-M).
 * Grammar and type restrictions stay separate from hardware access codes:
 * the latter depend on physical device mapping and cannot be deduced from
 * a PROBLEM-part SPC statement alone.
 */
export class BasicTransferStatementValidator {
    validate(node: BasicTransferStatementNode, env: Environment,
        state: BasicTransferValidationContext): void {
        const take = node.keyword.value === 'TAKE';
        const direction = take ? 'IN' : 'OUT';
        if (node.dation) {
            const type = state.expressionTypeResolver.resolve(node.dation, env);
            const underlying = type && state.resolveUnderlyingType(type);
            const target = underlying?.kind === SemanticTypeKind.Reference
                ? state.resolveUnderlyingType(underlying.target) : underlying;
            const anchor = expressionSource(node.dation) ?? node.directionKeyword ?? node.keyword;
            if (target && (target.kind !== SemanticTypeKind.Dation || target.dationClass !== 'BASIC')) {
                this.report(state, SemanticDiagnosticCode.InvalidBasicTransferDation,
                    anchor, `${node.keyword.value} benötigt eine BASIC-DATION (auch als REF DATION).`);
            } else if (target?.kind === SemanticTypeKind.Dation
                && !dationSupportsDirection(target, direction)) {
                this.report(state, SemanticDiagnosticCode.InvalidBasicTransferDirection,
                    anchor, `${node.keyword.value} benötigt eine BASIC-DATION mit Richtung ${direction} oder INOUT.`);
            }
        }

        for (const object of node.objects) {
            const type = state.expressionTypeResolver.resolve(object, env);
            const underlying = type && state.resolveUnderlyingType(type);
            const actual = underlying?.kind === SemanticTypeKind.Reference
                ? state.resolveUnderlyingType(underlying.target) : underlying;
            const anchor = expressionSource(object) ?? node.keyword;
            if (take) {
                const info = classifyObjectExpressionInfo(object, env,
                    candidate => state.resolveUnderlyingType(candidate));
                if (info.category === 'value' || info.assignmentProtected === true) {
                    this.report(state, SemanticDiagnosticCode.InvalidBasicTakeTarget, anchor,
                        'TAKE erwartet ein beschreibbares Datenobjekt.');
                }
            }
            // RTOS-UH 16.7-M compiler reference: TAKE accepts entire arrays,
            // even arrays of STRUCT and array-valued STRUCT components. SEND
            // rejects entire arrays; both directions reject individual STRUCT
            // values. Virtual arrays have not been verified and remain out
            // of scope rather than assuming a transferable memory layout.
            if (actual?.kind === SemanticTypeKind.Struct
                || actual?.kind === SemanticTypeKind.VirtualArray
                || (!take && actual?.kind === SemanticTypeKind.Array)) {
                this.report(state, SemanticDiagnosticCode.InvalidBasicTransferData,
                    anchor, `${node.keyword.value} unterstützt dieses vollständige Feld oder diese Struktur nicht.`);
            }
        }
    }

    private report(state: BasicTransferValidationContext, code: SemanticDiagnosticCode,
        source: SourceValue<string>, message: string): void {
        if (!source.location) return;
        state.diagnostics.push({ code, severity: SemanticDiagnosticSeverity.Error,
            location: source.location, message });
    }
}
