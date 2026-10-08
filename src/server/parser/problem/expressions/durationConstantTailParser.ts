// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../../core/sourceValue';

import {
    DurationConstantComponent,
    DurationConstantNode,
    DurationUnit
} from '../../../ast/problem/expressions/durationConstantNode';

import { TailParser } from '../../tailParser';

export interface DurationConstantPrefix {
    readonly value: SourceValue<string>;
    readonly integer: boolean;
}

/**
 * Parses the tail of a DURATION constant after its first numeric value has
 * already been consumed by the caller.
 */
export class DurationConstantTailParser extends TailParser {
    parseTail(
        first: DurationConstantPrefix
    ): DurationConstantNode | undefined {
        this.skipTrivia();

        const firstUnit = this.acceptDurationUnit();

        if (!firstUnit) {
            return undefined;
        }

        if (!first.integer && firstUnit.value !== 'SEC') {
            this.problems.error(
                first.value.location ?? this.location(),
                `${firstUnit.value} requires an integer value in a DURATION constant.`
            );
            return undefined;
        }

        const components: DurationConstantComponent[] = [{
            value: first.value,
            unit: firstUnit
        }];

        let previousUnit = firstUnit.value;

        while (previousUnit !== 'SEC') {
            this.skipTrivia();

            const integer = this.acceptIntegerLiteral();
            const floatingPoint = integer
                ? undefined
                : this.acceptFloatingPointLiteral();
            const number = integer ?? floatingPoint;

            if (!number) {
                break;
            }

            const value = this.tokenValue(number);

            this.skipTrivia();

            const unit = this.acceptDurationUnit();

            if (!unit) {
                this.problems.error(
                    this.location(),
                    "Expected 'MIN' or 'SEC' after DURATION value."
                );
                return undefined;
            }

            if (!this.isFollowingUnit(previousUnit, unit.value)) {
                this.problems.error(
                    unit.location ?? this.location(),
                    `DURATION units must occur in HRS - MIN - SEC order.`
                );
                return undefined;
            }

            if (floatingPoint && unit.value !== 'SEC') {
                this.problems.error(
                    value.location ?? this.location(),
                    `${unit.value} requires an integer value in a DURATION constant.`
                );
                return undefined;
            }

            components.push({
                value,
                unit
            });

            previousUnit = unit.value;
        }

        return new DurationConstantNode(components);
    }

    private acceptDurationUnit(): SourceValue<DurationUnit> | undefined {
        const token = this.acceptKeyword(['HRS', 'MIN', 'SEC']);

        if (!token) {
            return undefined;
        }

        return this.sourceValue(
            this.tokenText(token) as DurationUnit,
            this.location(token)
        );
    }

    private isFollowingUnit(
        previous: DurationUnit,
        current: DurationUnit
    ): boolean {
        switch (previous) {
            case 'HRS':
                return current === 'MIN' || current === 'SEC';

            case 'MIN':
                return current === 'SEC';

            case 'SEC':
                return false;
        }
    }
}
