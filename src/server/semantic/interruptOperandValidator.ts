// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { NameExpressionNode } from '../ast/problem/expressions/nameExpressionNode';
import type { Environment } from './environment';
import type { ExpressionTypeResolver } from './expressionTypeResolver';
import { SemanticDiagnosticCode, SemanticDiagnosticSeverity } from './semanticDiagnostic';
import type { SemanticDiagnostic } from './semanticDiagnostic';
import type { SemanticType } from './semanticType';
import { SemanticTypeKind } from './semanticType';
import { resolveSymbol } from './symbolResolver';

/** The common semantic requirement of WHEN, ENABLE, DISABLE and TRIGGER. */
export interface InterruptOperandValidationContext {
    readonly expressionTypeResolver: ExpressionTypeResolver;
    readonly diagnostics: SemanticDiagnostic[];
    resolveUnderlyingType(type: SemanticType): SemanticType | undefined;
}

export function validateInterruptOperand(
    name: NameExpressionNode,
    operation: string,
    code: SemanticDiagnosticCode,
    environment: Environment,
    state: InterruptOperandValidationContext
): void {
    // Resolve through the common expression infrastructure to retain bindings,
    // navigation and diagnostics, even for an invalid or unknown operand.
    const type = state.expressionTypeResolver.resolve(name, environment);
    const underlying = type && state.resolveUnderlyingType(type);
    const first = name.segments[0]?.identifier;
    if (!first) return;

    // An interrupt is an explicitly named object, not a structure component,
    // indexed item or function result.
    if (underlying?.kind === SemanticTypeKind.Interrupt
        && name.segments.length === 1 && !name.segments[0].suffix) return;

    // Unknown names are already reported by the expression resolver. In
    // particular, do not turn an unresolved name into a second type error.
    if (!type && !resolveSymbol(environment, first.value)) return;

    if (first.location) {
        state.diagnostics.push({
            code,
            severity: SemanticDiagnosticSeverity.Error,
            location: first.location,
            message: `${operation} erwartet einen INTERRUPT-Namen.`
        });
    }
}
