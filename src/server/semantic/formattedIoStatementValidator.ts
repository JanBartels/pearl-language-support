// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { SourceValue } from '../core/sourceValue';
import { FormattedIoFormatCompatibility } from './formattedIoFormatCompatibility';
import type { FormattedIoStatementNode } from '../ast/problem/statements/formattedIoStatementNode';
import type { FormatListNode } from '../ast/problem/statements/formatListNode';
import type { FormatReferenceNode } from '../ast/problem/statements/formatReferenceNode';
import type { FormatItemNode } from '../ast/problem/statements/formatItemNode';
import type { ExpressionNode } from '../ast/problem/expressions/expressionNode';
import type { Environment } from './environment';
import type { ExpressionTypeResolver } from './expressionTypeResolver';
import { classifyObjectExpressionInfo, expressionSource } from './expressionObject';
import { dationSupportsDirection } from './dationCapabilities';
import { IoSegmentNode } from '../ast/problem/statements/ioSegmentNode';
import { validateIoSegment, type IoSegmentValidationContext } from './ioSegmentValidator';
import { SemanticDiagnosticCode, SemanticDiagnosticSeverity } from './semanticDiagnostic';
import type { SemanticDiagnostic } from './semanticDiagnostic';
import type { SemanticType } from './semanticType';
import { SemanticTypeKind } from './semanticType';

export interface FormattedIoValidationContext extends IoSegmentValidationContext {
    resolveFormatReference(name: SourceValue<string>, environment: Environment): void;
    lookupFormatList(reference: FormatReferenceNode, environment: Environment): FormatListNode | undefined;
    tryEvaluateFormatRepeat(expression: ExpressionNode, environment: Environment): bigint | undefined;
}

/** Foundational formatted-I/O checks. Format/data pairing is delegated to
 * FormattedIoFormatCompatibility; widths remain a separate concern.
 */
export class FormattedIoStatementValidator {
    validateStatement(node: FormattedIoStatementNode, env: Environment,
        state: FormattedIoValidationContext): void {
        const diagnosticsBefore = state.diagnostics.length;
        const name = node.keyword.value;
        const input = name === 'GET' || (name === 'CONVERT' && node.directionKeyword?.value === 'FROM');
        const objectTypes: (SemanticType | undefined)[] = [];
        for (const object of node.objects) {
            const objectType = object instanceof IoSegmentNode
                ? validateIoSegment(object, env, state)
                : state.expressionTypeResolver.resolve(object, env);
            objectTypes.push(objectType);
            if (!input) continue;
            const target = object instanceof IoSegmentNode ? object.array : object;
            const info = classifyObjectExpressionInfo(target, env,
                type => state.resolveUnderlyingType(type));
            if (info.category === 'value' || info.assignmentProtected === true) {
                this.report(state, SemanticDiagnosticCode.InvalidFormattedIoData,
                    expressionSource(target) ?? node.keyword,
                    `${name} benötigt beschreibbare Datenobjekte.`);
            }
        }
        if (node.target) {
            const type = state.expressionTypeResolver.resolve(node.target, env);
            const underlying = type && state.resolveUnderlyingType(type);
            const actual = underlying?.kind === SemanticTypeKind.Reference
                ? state.resolveUnderlyingType(underlying.target) : underlying;
            const anchor = expressionSource(node.target) ?? node.directionKeyword ?? node.keyword;
            if (name === 'CONVERT') {
                if (actual && actual.kind !== SemanticTypeKind.Character) {
                    this.report(state, SemanticDiagnosticCode.InvalidFormattedIoTarget, anchor,
                        'CONVERT benötigt einen CHARACTER-Ausdruck beziehungsweise eine CHARACTER-Variable.');
                }
                if (!input) {
                    const info = classifyObjectExpressionInfo(node.target, env,
                        t => state.resolveUnderlyingType(t));
                    if (info.category === 'value' || info.assignmentProtected === true) {
                        this.report(state, SemanticDiagnosticCode.InvalidFormattedIoTarget, anchor,
                            'CONVERT TO benötigt eine beschreibbare CHARACTER-Variable.');
                    }
                }
            } else if (actual) {
                if (actual.kind !== SemanticTypeKind.Dation || actual.dationClass !== 'ALPHIC') {
                    this.report(state, SemanticDiagnosticCode.InvalidFormattedIoDation, anchor,
                        `${name} benötigt eine DATION ALPHIC.`);
                } else if (!dationSupportsDirection(actual, name === 'GET' ? 'IN' : 'OUT')) {
                    this.report(state, SemanticDiagnosticCode.InvalidFormattedIoDirection, anchor,
                        `${name} benötigt eine DATION mit passender Übertragungsrichtung.`);
                }
            }
        }
        if (node.formats) {
            this.validateFormats(node.formats, env, state);
            // Avoid cascading format/data diagnostics when the statement itself
            // already has invalid operands, indices or format references.
            if (state.diagnostics.length === diagnosticsBefore) {
                new FormattedIoFormatCompatibility().validate(node, objectTypes, env, state);
            }
        }
    }

    validateFormats(formats: FormatListNode, env: Environment,
        state: FormattedIoValidationContext): void {
        for (const item of formats.items) this.validateItem(item, env, state);
    }

    private validateItem(item: FormatItemNode, env: Environment,
        state: FormattedIoValidationContext): void {
        if (item.repeatCount) state.expressionTypeResolver.resolve(item.repeatCount, env);
        for (const argument of item.argumentsList) state.expressionTypeResolver.resolve(argument, env);
        if (item.reference) state.resolveFormatReference(item.reference.identifier, env);
        if (item.group) this.validateFormats(item.group, env, state);
        if (item.keyword?.value !== 'RST') return;
        const variable = item.argumentsList[0];
        if (!variable) return; // Syntax diagnostics already emitted.
        const type = state.expressionTypeResolver.resolve(variable, env);
        const actual = type && state.resolveUnderlyingType(type);
        const info = classifyObjectExpressionInfo(variable, env,
            t => state.resolveUnderlyingType(t));
        if (actual && (actual.kind !== SemanticTypeKind.Fixed
                || info.category !== 'object' || info.assignmentProtected !== false)) {
            this.report(state, SemanticDiagnosticCode.InvalidFormatReportVariable,
                expressionSource(variable) ?? item.keyword,
                'RST(...) erwartet eine beschreibbare FIXED-Variable.');
        }
    }

    private report(state: FormattedIoValidationContext, code: SemanticDiagnosticCode,
        source: SourceValue<string>, message: string): void {
        if (source.location) state.diagnostics.push({
            code, severity: SemanticDiagnosticSeverity.Error, location: source.location, message
        });
    }
}
