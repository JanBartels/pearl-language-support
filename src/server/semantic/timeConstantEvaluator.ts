// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { AstNode } from '../ast/astNode';
import type { SourceValue } from '../core/sourceValue';
import type { ClockConstantNode } from '../ast/problem/expressions/clockConstantNode';
import type { DurationConstantNode, DurationUnit } from '../ast/problem/expressions/durationConstantNode';
import type { SignedConstantExpressionNode } from '../ast/problem/expressions/signedConstantExpressionNode';
import type { Environment } from './environment';
import type { TimeResolution } from './moduleConfiguration';
import {
    addDecimalTimeValues,
    compareDecimalTimeValueToInteger,
    createDecimalTimeValue,
    isDecimalTimeValueMultipleOf,
    moduloDecimalTimeValue,
    multiplyDecimalTimeValue,
    parseDecimalTimeValue
} from './decimalTimeValue';
import {
    SemanticConstantKind,
    type ClockConstantValue,
    type DurationConstantValue,
    type TimeConstantValue
} from './semanticConstantValue';

export interface TimeConstantEvaluatorContext {
    timeResolution(environment: Environment): TimeResolution;

    recordTimeConstantValue(
        node: AstNode,
        value: TimeConstantValue
    ): void;

    reportInvalidClockConstant(
        source: SourceValue<string>,
        message: string
    ): void;

    reportTimeResolutionLoss(
        source: SourceValue<string>,
        typeName: 'CLOCK' | 'DURATION',
        resolution: TimeResolution
    ): void;
}

export class TimeConstantEvaluator {
    constructor(
        private readonly context: TimeConstantEvaluatorContext
    ) {}

    evaluateClock(
        node: ClockConstantNode,
        environment: Environment
    ): ClockConstantValue | undefined {
        const hours = this.parseInteger(node.hours);
        const minutes = this.parseInteger(node.minutes);
        const seconds = parseDecimalTimeValue(node.seconds.value);

        if (hours === undefined || minutes === undefined || !seconds) {
            return undefined;
        }

        if (minutes < BigInt(0) || minutes > BigInt(59)) {
            this.context.reportInvalidClockConstant(
                node.minutes,
                'Die Minutenangabe einer CLOCK-Konstante muss zwischen 0 und 59 liegen.'
            );
            return undefined;
        }

        if (
            seconds.coefficient < BigInt(0)
            || compareDecimalTimeValueToInteger(seconds, BigInt(60)) >= 0
        ) {
            this.context.reportInvalidClockConstant(
                node.seconds,
                'Die Sekundenangabe einer CLOCK-Konstante muss zwischen 0 und kleiner 60 liegen.'
            );
            return undefined;
        }

        let value = createDecimalTimeValue(hours * BigInt(3600), 0);
        value = addDecimalTimeValues(
            value,
            createDecimalTimeValue(minutes * BigInt(60), 0)
        );
        value = addDecimalTimeValues(value, seconds);
        value = moduloDecimalTimeValue(value, BigInt(24 * 60 * 60));

        const result: ClockConstantValue = {
            kind: SemanticConstantKind.Clock,
            secondsSinceMidnight: value
        };

        this.context.recordTimeConstantValue(node, result);
        this.checkResolution(node.seconds, 'CLOCK', value, environment);

        return result;
    }

    evaluateDuration(
        node: DurationConstantNode,
        environment: Environment
    ): DurationConstantValue | undefined {
        let value = createDecimalTimeValue(BigInt(0), 0);

        for (const component of node.components) {
            const parsed = parseDecimalTimeValue(component.value.value);

            if (!parsed) {
                return undefined;
            }

            value = addDecimalTimeValues(
                value,
                multiplyDecimalTimeValue(
                    parsed,
                    this.durationUnitSeconds(component.unit.value)
                )
            );
        }

        const result: DurationConstantValue = {
            kind: SemanticConstantKind.Duration,
            seconds: value
        };

        this.context.recordTimeConstantValue(node, result);

        const source = node.components[node.components.length - 1]?.value;

        if (source) {
            this.checkResolution(source, 'DURATION', value, environment);
        }

        return result;
    }


    evaluateSignedDurationConstantExpression(
        node: SignedConstantExpressionNode,
        environment: Environment
    ): DurationConstantValue | undefined {
        if (node.operand.kind !== 'duration') {
            return undefined;
        }

        const duration = this.evaluateDuration(node.operand.constant, environment);

        if (!duration) {
            return undefined;
        }

        const seconds = node.sign.value === '-'
            ? multiplyDecimalTimeValue(duration.seconds, BigInt(-1))
            : duration.seconds;

        const result: DurationConstantValue = {
            kind: SemanticConstantKind.Duration,
            seconds
        };

        this.context.recordTimeConstantValue(node, result);
        return result;
    }

    private parseInteger(
        source: SourceValue<string>
    ): bigint | undefined {
        try {
            return BigInt(source.value);
        } catch {
            return undefined;
        }
    }

    private durationUnitSeconds(unit: DurationUnit): bigint {
        switch (unit) {
            case 'HRS':
                return BigInt(3600);

            case 'MIN':
                return BigInt(60);

            case 'SEC':
                return BigInt(1);
        }
    }

    private checkResolution(
        source: SourceValue<string>,
        typeName: 'CLOCK' | 'DURATION',
        value: { readonly coefficient: bigint; readonly scale: number },
        environment: Environment
    ): void {
        const resolution = this.context.timeResolution(environment);

        if (
            !isDecimalTimeValueMultipleOf(
                value,
                resolution.numerator,
                resolution.denominator
            )
        ) {
            this.context.reportTimeResolutionLoss(
                source,
                typeName,
                resolution
            );
        }
    }
}
