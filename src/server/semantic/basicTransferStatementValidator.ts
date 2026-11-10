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
            // Chapter 6.2 lists simple data types; total field and structure
            // transfers are NOT established for BASIC-DATIONs. Do not guess
            // a byte layout for such objects.
            if (actual?.kind === SemanticTypeKind.Array
                || actual?.kind === SemanticTypeKind.VirtualArray
                || actual?.kind === SemanticTypeKind.Struct) {
                this.report(state, SemanticDiagnosticCode.InvalidBasicTransferData,
                    anchor, `${node.keyword.value} unterstützt nur einfache Datenobjekte, keine vollständigen Felder oder Strukturen.`);
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
