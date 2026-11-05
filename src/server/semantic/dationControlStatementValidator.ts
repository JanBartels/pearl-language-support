// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { SourceValue } from '../core/sourceValue';
import type { DationControlStatementNode } from '../ast/problem/statements/dationControlStatementNode';
import type { DationControlOptionNode } from '../ast/problem/statements/dationControlOptionNode';
import type { Environment } from './environment';
import type { ExpressionTypeResolver } from './expressionTypeResolver';
import { expressionSource } from './expressionObject';
import { SemanticDiagnosticCode, SemanticDiagnosticSeverity } from './semanticDiagnostic';
import type { SemanticDiagnostic } from './semanticDiagnostic';
import type { SemanticType } from './semanticType';
import { SemanticTypeKind } from './semanticType';
import { resolveSymbol } from './symbolResolver';

export interface DationControlValidationContext {
    readonly expressionTypeResolver: ExpressionTypeResolver;
    readonly diagnostics: SemanticDiagnostic[];
    resolveUnderlyingType(type: SemanticType): SemanticType | undefined;
}

/** OPEN/CLOSE constraints are checked outside the parser and independently of LSP. */
export class DationControlStatementValidator {
    validate(node: DationControlStatementNode, env: Environment,
        state: DationControlValidationContext): void {
        if (node.dation) {
            const type = state.expressionTypeResolver.resolve(node.dation, env);
            const actual = type && state.resolveUnderlyingType(type);
            // A REF DATION may be used as an indirect DATION operand.
            const target = actual?.kind === SemanticTypeKind.Reference
                ? state.resolveUnderlyingType(actual.target) : actual;
            const first = node.dation.segments[0]?.identifier;
            if (first && target?.kind !== SemanticTypeKind.Dation
                && (type || resolveSymbol(env, first.value))) {
                this.report(state, SemanticDiagnosticCode.InvalidDationControlTarget,
                    first, `${node.keyword.value} erwartet eine DATION oder REF DATION.`);
            }
        }

        const name = node.keyword.value;
        const seen = new Map<string, DationControlOptionNode>();
        let fileMode: DationControlOptionNode | undefined;
        let closeMode: DationControlOptionNode | undefined;
        for (const option of node.options) {
            const kind = option.keyword.value;
            const allowed = name === 'OPEN'
                ? ['IDF', 'NEW', 'OLD', 'ANY', 'EXCLUSIVE'].includes(kind)
                : ['CAN', 'PRM'].includes(kind);
            if (!allowed) {
                this.report(state, SemanticDiagnosticCode.InvalidDationControlOption,
                    option.keyword, `${kind} ist keine gültige Option für ${name}.`);
            }
            if (seen.has(kind)) {
                this.report(state, SemanticDiagnosticCode.DuplicateDationControlOption,
                    option.keyword, `${kind} ist in ${name} mehrfach angegeben.`);
            } else seen.set(kind, option);

            if (kind === 'NEW' || kind === 'OLD' || kind === 'ANY') {
                if (fileMode && fileMode.keyword.value !== kind) {
                    this.report(state, SemanticDiagnosticCode.ConflictingDationControlOptions,
                        option.keyword, 'NEW, OLD und ANY schließen einander aus.');
                }
                fileMode ??= option;
            }
            if (kind === 'CAN' || kind === 'PRM') {
                if (closeMode && closeMode.keyword.value !== kind) {
                    this.report(state, SemanticDiagnosticCode.ConflictingDationControlOptions,
                        option.keyword, 'CAN und PRM schließen einander aus.');
                }
                closeMode ??= option;
            }
            if (kind === 'IDF') this.checkIdf(option, env, state);
        }

        // The nested RTOS-UH option [,(NEW|OLD|ANY)[,EXCLUSIVE]]
        // requires a file existence mode before EXCLUSIVE can be used.
        if (name === 'OPEN' && seen.has('EXCLUSIVE') && !fileMode && seen.has('IDF')) {
            this.report(state, SemanticDiagnosticCode.InvalidDationControlOption,
                seen.get('EXCLUSIVE')!.keyword,
                'EXCLUSIVE erfordert NEW, OLD oder ANY.');
        }

        // UH's NEW/OLD/ANY and EXCLUSIVE extend OPEN BY IDF(...).
        if (name === 'OPEN' && !seen.has('IDF')) {
            for (const option of node.options) {
                if (['NEW', 'OLD', 'ANY', 'EXCLUSIVE'].includes(option.keyword.value)) {
                    this.report(state, SemanticDiagnosticCode.InvalidDationControlOption,
                        option.keyword, `${option.keyword.value} erfordert OPEN ... BY IDF(...).`);
                }
            }
        }
    }

    private checkIdf(option: DationControlOptionNode, env: Environment,
        state: DationControlValidationContext): void {
        if (!option.argument) return;
        const type = state.expressionTypeResolver.resolve(option.argument, env);
        const actual = type && state.resolveUnderlyingType(type);
        if (actual && actual.kind !== SemanticTypeKind.Character) {
            this.report(state, SemanticDiagnosticCode.InvalidDationControlIdf,
                expressionSource(option.argument) ?? option.keyword,
                'IDF(...) erwartet einen CHARACTER-Ausdruck.');
        }
    }

    private report(state: DationControlValidationContext, code: SemanticDiagnosticCode,
        source: SourceValue<string>,
        message: string): void {
        if (source.location) state.diagnostics.push({
            code, severity: SemanticDiagnosticSeverity.Error,
            location: source.location, message
        });
    }
}
