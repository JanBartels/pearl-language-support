// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { SourceValue } from '../core/sourceValue';
import type { ExpressionNode } from '../ast/problem/expressions/expressionNode';
import { IoSegmentNode } from '../ast/problem/statements/ioSegmentNode';
import type { FormatItemNode } from '../ast/problem/statements/formatItemNode';
import type { FormattedIoStatementNode } from '../ast/problem/statements/formattedIoStatementNode';
import type { Environment } from './environment';
import type { FormattedIoValidationContext } from './formattedIoStatementValidator';
import type { SemanticType } from './semanticType';
import { SemanticTypeKind } from './semanticType';
import { SemanticDiagnosticCode, SemanticDiagnosticSeverity } from './semanticDiagnostic';
import { FormatExecutionCursor } from './formatExecutionCursor';
import { expressionSource } from './expressionObject';

const NON_CONSUMING = new Set(['RST', 'X', 'SKIP', 'PAGE', 'S']);

interface DataElement {
    readonly expression: ExpressionNode;
    readonly type: SemanticType;
    readonly count: bigint | undefined;
}

/**
 * First static execution phase for formatted I/O. This deliberately does not
 * validate field widths, numerical formatting or other runtime parameters.
 * Unknown element counts or format repetitions stop the analysis before any
 * guess about subsequent pairings can produce false positive diagnostics.
 */
export class FormattedIoFormatCompatibility {
    validate(node: FormattedIoStatementNode, objectTypes: readonly (SemanticType | undefined)[],
        environment: Environment, state: FormattedIoValidationContext): void {
        const formats = node.formats;
        if (!formats || formats.items.length === 0) return;
        const data = node.objects.map((object, index) =>
            this.describeData(object, objectTypes[index], environment, state));
        const cursor = new FormatExecutionCursor(formats,
            expression => state.tryEvaluateFormatRepeat(expression, environment),
            reference => state.lookupFormatList(reference, environment),
            item => !!item.keyword && NON_CONSUMING.has(item.keyword.value));
        let warned = false;
        let steps = 0;
        // Deduplicate the same mismatch at one source format for each data
        // type across the entire statement, including implicit repetitions.
        const reportedIncompatibilities = new Map<FormatItemNode, Set<SemanticTypeKind>>();
        for (const [index, entry] of data.entries()) {
            if (!entry || entry.count === undefined) return;
            const visitedStates = new Map<string, bigint>();
            for (let element = 0n; element < entry.count; element++) {
                // Keep the LSP responsive on non-periodic, enormous format
                // sequences. Only genuinely visited pairings are diagnosed.
                if (++steps > 50000) return;
                let format: FormatItemNode | undefined;
                let restarted = false;
                let triedRestart = false;
                while (!format) {
                    const next = cursor.next();
                    if (next.kind === 'unknown') return;
                    if (next.kind === 'end') {
                        if (triedRestart) return; // No consuming formats in the loop.
                        triedRestart = true;
                        restarted = true;
                        cursor.restart();
                        continue;
                    }
                    if (!next.item.keyword || NON_CONSUMING.has(next.item.keyword.value)) {
                        // Control formats never consume data. Their repetitions
                        // need not be expanded one by one for static pairing.
                        cursor.skipIdenticalFormats(next.item);
                        continue;
                    }
                    format = next.item;
                }
                if (restarted && !warned) {
                    warned = true;
                    const position = node.byKeyword ?? node.keyword;
                    this.report(state, SemanticDiagnosticCode.ImplicitFormatListRepetition,
                        SemanticDiagnosticSeverity.Warning, position,
                        'Die Formatliste wird implizit wiederholt, um weitere Datenobjekte zu verarbeiten.');
                }
                const kind = this.underlying(entry.type, state);
                const seenKinds = reportedIncompatibilities.get(format) ?? new Set<SemanticTypeKind>();
                if (kind && !this.compatible(format.keyword!.value, kind.kind)
                    && !seenKinds.has(kind.kind)) {
                    seenKinds.add(kind.kind);
                    reportedIncompatibilities.set(format, seenKinds);
                    const source = format.keyword!;
                    const dataName = expressionSource(entry.expression)?.value ?? `Datenobjekt ${index + 1}`;
                    this.report(state, SemanticDiagnosticCode.IncompatibleFormattedIoFormat,
                        SemanticDiagnosticSeverity.Error, source,
                        `Format ${source.value} ist mit dem Datenobjekt ${dataName} (${this.typeName(kind.kind)}) nicht verträglich.`,
                        expressionSource(entry.expression));
                }
                // In a homogeneous field, consecutive identical formats can
                // be processed in one operation, without expanded AST copies.
                const remaining = entry.count - element - 1n;
                element += cursor.skipIdenticalFormats(format, remaining);
                if (element + 1n >= entry.count) continue;

                // Reaching an identical cursor state while processing the same
                // field proves a complete periodic cycle. One traversal has
                // already checked all its pairings and any implicit restart.
                const processed = element + 1n;
                const key = cursor.stateKey();
                const previous = visitedStates.get(key);
                if (previous === undefined) visitedStates.set(key, processed);
                else {
                    const period = processed - previous;
                    if (period > 0n) {
                        const cycles = (entry.count - processed) / period;
                        element += cycles * period;
                    }
                }
            }
        }
    }

    private describeData(expression: ExpressionNode, original: SemanticType | undefined,
        env: Environment, state: FormattedIoValidationContext): DataElement | undefined {
        if (!original) return undefined;
        let resolved = this.underlying(original, state);
        if (!resolved) return undefined;
        if (expression instanceof IoSegmentNode) {
            const from = expression.lower && state.tryEvaluateFixedExpression(expression.lower, env);
            const to = expression.upper && state.tryEvaluateFixedExpression(expression.upper, env);
            return { expression, type: resolved,
                count: from !== undefined && to !== undefined && from <= to ? to - from + 1n : undefined };
        }
        if (resolved.kind === SemanticTypeKind.Array) {
            const count = resolved.dimensions.reduce((product, dimension) =>
                product * (dimension.upperBound - dimension.lowerBound + 1n), 1n);
            return { expression, type: resolved.elementType, count: count >= 0n ? count : undefined };
        }
        if (resolved.kind === SemanticTypeKind.VirtualArray) {
            return { expression, type: resolved.elementType, count: undefined };
        }
        return { expression, type: resolved, count: 1n };
    }

    private underlying(type: SemanticType, state: FormattedIoValidationContext): SemanticType | undefined {
        let resolved = state.resolveUnderlyingType(type);
        if (resolved?.kind === SemanticTypeKind.Reference) {
            resolved = state.resolveUnderlyingType(resolved.target);
        }
        return resolved;
    }

    private compatible(format: string, type: SemanticTypeKind): boolean {
        switch (format) {
            case 'F': case 'E':
                return type === SemanticTypeKind.Fixed || type === SemanticTypeKind.Float;
            case 'A': return type === SemanticTypeKind.Character;
            case 'B': case 'B1': case 'B3': case 'B4': return type === SemanticTypeKind.Bit;
            case 'T': return type === SemanticTypeKind.Clock;
            case 'D': return type === SemanticTypeKind.Duration;
            case 'LIST': return [SemanticTypeKind.Fixed, SemanticTypeKind.Float,
                SemanticTypeKind.Character, SemanticTypeKind.Bit,
                SemanticTypeKind.Clock, SemanticTypeKind.Duration].includes(type);
            default: return true;
        }
    }

    private typeName(kind: SemanticTypeKind): string {
        return SemanticTypeKind[kind] ?? 'unbekannt';
    }

    private report(state: FormattedIoValidationContext, code: SemanticDiagnosticCode,
        severity: SemanticDiagnosticSeverity, source: SourceValue<string>, message: string,
        related?: SourceValue<string>): void {
        if (!source.location) return;
        state.diagnostics.push({ code, severity, location: source.location, message,
            ...(related?.location ? { relatedLocations: [{ location: related.location,
                message: 'Zu diesem Format zugeordnetes Datenobjekt.' }] } : {}) });
    }
}
