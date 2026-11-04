// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from '../ast/astKind';
import type { AstNode } from '../ast/astNode';
import { TaskingStatementNode } from '../ast/problem/statements/taskingStatementNode';
import { TaskingTimedStartNode } from '../ast/problem/statements/taskingTimedStartNode';
import { TaskingInterruptStartNode } from '../ast/problem/statements/taskingInterruptStartNode';
import { TaskingTimeClauseNode } from '../ast/problem/statements/taskingTimeClauseNode';
import { TaskingFrequencyNode } from '../ast/problem/statements/taskingFrequencyNode';
import { TaskingFrequencyLimitNode } from '../ast/problem/statements/taskingFrequencyLimitNode';
import type { ExpressionNode } from '../ast/problem/expressions/expressionNode';
import { NameExpressionNode } from '../ast/problem/expressions/nameExpressionNode';
import { ParenthesizedExpressionNode } from '../ast/problem/expressions/parenthesizedExpressionNode';
import { MonadicExpressionNode } from '../ast/problem/expressions/monadicExpressionNode';
import { DyadicExpressionNode } from '../ast/problem/expressions/dyadicExpressionNode';
import type { SourceValue } from '../core/sourceValue';
import type { Environment } from './environment';
import type { ExpressionTypeResolver } from './expressionTypeResolver';
import { addDecimalTimeValues, multiplyDecimalTimeValue } from './decimalTimeValue';
import type { DecimalTimeValue } from './decimalTimeValue';
import { SemanticConstantKind } from './semanticConstantValue';
import type { SemanticConstantValue, TimeConstantValue } from './semanticConstantValue';
import type { SemanticDiagnostic } from './semanticDiagnostic';
import { SemanticDiagnosticCode, SemanticDiagnosticSeverity } from './semanticDiagnostic';
import { SemanticTypeKind } from './semanticType';
import type { SemanticType } from './semanticType';
import type { DataObjectSymbol, SemanticSymbol } from './symbol';
import { SymbolKind } from './symbolKind';
import { resolveSymbol } from './symbolResolver';
import { validateInterruptOperand } from './interruptOperandValidator';

/** The subset of the existing semantic state needed by task scheduling.
 * Keeping the contract structural prevents the validator from depending on
 * SemanticAnalyzer's private implementation or duplicating symbol resolution.
 */
export interface TaskingValidationContext {
    readonly expressionTypeResolver: ExpressionTypeResolver;
    readonly timeConstantValues: ReadonlyMap<AstNode, TimeConstantValue>;
    readonly namedConstantValues: ReadonlyMap<DataObjectSymbol, SemanticConstantValue>;
    readonly diagnostics: SemanticDiagnostic[];
    resolveUnderlyingType(type: SemanticType): SemanticType | undefined;
    tryEvaluateFixedExpression(expression: ExpressionNode, environment: Environment): bigint | undefined;
    bind(source: SourceValue<string>, symbol: SemanticSymbol): void;
    reportUnknownIdentifier(source: SourceValue<string>): void;
    reportInvalidTaskPriority(source: SourceValue<string>, value: bigint): void;
}

/** Semantic validation of RTOS-UH task-control statements. */
export class TaskingStatementValidator {
    /** The six task-control statements share task/interrupt lookup and expression typing.
     * A source expression retains its REF type for Hover; value-context
     * dereferencing is applied only for checking scheduling clauses.
     */
    validate(
        node: TaskingStatementNode,
        environment: Environment,
        state: TaskingValidationContext
    ): void {
        if (node.task) this.analyzeTaskingTarget(node, environment, state);

        const start = node.startCondition;
        if (start instanceof TaskingInterruptStartNode) {
            if (start.interrupt) {
                validateInterruptOperand(start.interrupt, 'WHEN',
                    SemanticDiagnosticCode.InvalidTaskingInterrupt, environment, state);
            }
        } else if (start instanceof TaskingTimedStartNode) {
            if (start.initial) {
                this.analyzeTaskingTimeClause(start.initial, environment, state);
            }
            if (start.frequency) {
                this.analyzeTaskingFrequency(start.frequency, environment, state);
            }
        }

        if (node.priority && node.keyword.value === 'ACTIVATE') {
            const type = this.taskingValueType(node.priority, environment, state);
            const source = node.priorityTokens[0] ?? node.priorityKeyword ?? node.keyword;
            if (type && type.kind !== SemanticTypeKind.Fixed) {
                this.reportTaskingProblem(state, SemanticDiagnosticCode.InvalidTaskingPriorityType,
                    source, 'PRIO erwartet einen FIXED-Ausdruck.');
            } else if (type?.kind === SemanticTypeKind.Fixed) {
                const value = state.tryEvaluateFixedExpression(node.priority, environment);
                if (value === undefined) {
                    // RTOS-UH requires a constant priority: an ordinary FIXED
                    // variable, even with INIT, is not a constant expression.
                    this.reportTaskingProblem(state, SemanticDiagnosticCode.InvalidTaskPriority,
                        source, 'PRIO erwartet einen konstanten FIXED-Ausdruck (z. B. eine INV FIXED-Konstante).');
                } else if (value < BigInt(1) || value > BigInt(32767)) {
                    state.reportInvalidTaskPriority(source, value);
                }
            }
        }
    }

    private analyzeTaskingTarget(
        statement: TaskingStatementNode,
        environment: Environment,
        state: TaskingValidationContext
    ): void {
        const name = statement.task!;
        const first = name.segments[0]?.identifier;
        if (!first) return;
        const symbol = resolveSymbol(environment, first.value);
        if (!symbol) {
            // The shared resolver reports the unknown name and still resolves
            // any nested index expressions for Hover and Find References.
            state.expressionTypeResolver.resolve(name, environment);
            return;
        }
        if (symbol.kind === SymbolKind.Task) {
            state.bind(first, symbol);
            if (name.segments.length === 1 && !name.segments[0].suffix) return;
            // Resolve nested suffix arguments even when the TASK itself cannot
            // have selectors. This preserves bindings in an erroneous program.
            state.expressionTypeResolver.resolve(name, environment);
            this.reportTaskingProblem(state, SemanticDiagnosticCode.InvalidTaskingTarget,
                first, `${statement.keyword.value} erwartet einen TASK-Namen oder eine REF TASK.`);
            return;
        }
        const type = state.expressionTypeResolver.resolve(name, environment);
        const underlying = type && state.resolveUnderlyingType(type);
        const target = underlying?.kind === SemanticTypeKind.Reference
            ? state.resolveUnderlyingType(underlying.target) : underlying;
        if (target?.kind !== SemanticTypeKind.Task) {
            // Avoid a secondary type error for an already unresolved expression.
            if (type) {
                this.reportTaskingProblem(state, SemanticDiagnosticCode.InvalidTaskingTarget,
                    first, `${statement.keyword.value} erwartet einen TASK-Namen oder eine REF TASK.`);
            }
        }
    }

    private analyzeTaskingTimeClause(
        clause: TaskingTimeClauseNode,
        environment: Environment,
        state: TaskingValidationContext
    ): void {
        this.analyzeTaskingTimeExpression(clause.expression, clause.expressionTokens[0] ?? clause.keyword,
            clause.keyword.value === 'AT' ? SemanticTypeKind.Clock : SemanticTypeKind.Duration,
            clause.keyword.value, environment, state);
    }

    private analyzeTaskingFrequency(
        frequency: TaskingFrequencyNode,
        environment: Environment,
        state: TaskingValidationContext
    ): void {
        this.analyzeTaskingTimeExpression(frequency.interval,
            frequency.intervalTokens[0] ?? frequency.keyword,
            SemanticTypeKind.Duration, frequency.keyword.value, environment, state);
        const limit = frequency.limit;
        if (limit) {
            this.analyzeTaskingFrequencyLimit(limit, environment, state);
        }
    }

    private analyzeTaskingFrequencyLimit(
        limit: TaskingFrequencyLimitNode,
        environment: Environment,
        state: TaskingValidationContext
    ): void {
        this.analyzeTaskingTimeExpression(limit.expression, limit.expressionTokens[0] ?? limit.keyword,
            limit.keyword.value === 'UNTIL' ? SemanticTypeKind.Clock : SemanticTypeKind.Duration,
            limit.keyword.value, environment, state);
    }

    private analyzeTaskingTimeExpression(
        expression: ExpressionNode | undefined,
        source: SourceValue<string>,
        expected: SemanticTypeKind.Clock | SemanticTypeKind.Duration,
        clause: string,
        environment: Environment,
        state: TaskingValidationContext
    ): void {
        if (!expression) return; // Parser owns incomplete-expression diagnostics.
        const actual = this.taskingValueType(expression, environment, state);
        if (!actual) return; // Let the resolver report unresolved operands.
        if (actual.kind !== expected) {
            this.reportTaskingProblem(state, SemanticDiagnosticCode.InvalidTaskingTimeType,
                source, `${clause} erwartet einen ${expected === SemanticTypeKind.Clock ? 'CLOCK' : 'DURATION'}-Ausdruck.`);
            return;
        }
        if (expected !== SemanticTypeKind.Duration || clause === 'UNTIL') return;
        // Only reject provably negative values. Zero denotes scheduling on
        // the next timer tick in RTOS-UH. A runtime DURATION value cannot
        // be assumed negative and must not produce a false positive.
        const known = this.tryEvaluateTaskingDuration(expression, environment, state);
        if (known && known.coefficient < BigInt(0)) {
            this.reportTaskingProblem(state, SemanticDiagnosticCode.NegativeTaskingDuration,
                source, `${clause} erwartet eine nichtnegative DURATION (größer oder gleich 0).`);
        }
    }

    private taskingValueType(
        expression: ExpressionNode,
        environment: Environment,
        state: TaskingValidationContext
    ): SemanticType | undefined {
        const declared = state.expressionTypeResolver.resolve(expression, environment);
        const actual = declared && state.resolveUnderlyingType(declared);
        return actual?.kind === SemanticTypeKind.Reference
            ? state.resolveUnderlyingType(actual.target) : actual;
    }

    /** Exact best-effort constant evaluation. The time evaluator owns literal
     * decoding and time-resolution diagnostics; this method only combines its
     * already evaluated values, without introducing a parallel literal parser.
     */
    private tryEvaluateTaskingDuration(
        expression: ExpressionNode,
        environment: Environment,
        state: TaskingValidationContext
    ): DecimalTimeValue | undefined {
        switch (expression.kind) {
            case AstKind.DurationConstant: {
                const value = state.timeConstantValues.get(expression);
                return value?.kind === SemanticConstantKind.Duration ? value.seconds : undefined;
            }
            case AstKind.NameExpression: {
                const name = expression as NameExpressionNode;
                if (name.segments.length !== 1 || name.segments[0].suffix) return undefined;
                const symbol = resolveSymbol(environment, name.segments[0].identifier.value);
                const value = symbol?.kind === SymbolKind.DataObject
                    ? state.namedConstantValues.get(symbol) : undefined;
                return value?.kind === SemanticConstantKind.Duration ? value.seconds : undefined;
            }
            case AstKind.ParenthesizedExpression: {
                const inner = (expression as ParenthesizedExpressionNode).expression;
                return inner ? this.tryEvaluateTaskingDuration(inner, environment, state) : undefined;
            }
            case AstKind.MonadicExpression: {
                const unary = expression as MonadicExpressionNode;
                if (!unary.operand || (unary.operator.value !== '-' && unary.operator.value !== '+')) return undefined;
                const value = this.tryEvaluateTaskingDuration(unary.operand, environment, state);
                return value ? multiplyDecimalTimeValue(value, unary.operator.value === '-' ? BigInt(-1) : BigInt(1))
                    : undefined;
            }
            case AstKind.DyadicExpression: {
                const binary = expression as DyadicExpressionNode;
                if (!binary.right || (binary.operator.value !== '+' && binary.operator.value !== '-')) return undefined;
                const left = this.tryEvaluateTaskingDuration(binary.left, environment, state);
                const right = this.tryEvaluateTaskingDuration(binary.right, environment, state);
                return left && right ? addDecimalTimeValues(left,
                    multiplyDecimalTimeValue(right, binary.operator.value === '-' ? BigInt(-1) : BigInt(1)))
                    : undefined;
            }
            default:
                return undefined;
        }
    }

    private reportTaskingProblem(
        state: TaskingValidationContext,
        code: SemanticDiagnosticCode,
        source: SourceValue<string>,
        message: string
    ): void {
        if (!source.location) return;
        state.diagnostics.push({
            code, severity: SemanticDiagnosticSeverity.Error,
            location: source.location, message
        });
    }

}
