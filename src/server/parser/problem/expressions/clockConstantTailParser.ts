// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../../core/sourceValue';

import { ClockConstantNode } from '../../../ast/problem/expressions/clockConstantNode';

import { TailParser } from '../../tailParser';

/**
 * Parses the tail of a CLOCK constant after its hour value has already been
 * consumed by the caller.
 */
export class ClockConstantTailParser extends TailParser {
    parseTail(
        hours: SourceValue<string>
    ): ClockConstantNode | undefined {
        this.skipTrivia();

        if (!this.expectColon("Expected ':' after CLOCK hour value.")) {
            return undefined;
        }

        const minutes = this.expectIntegerLiteral(
            'Expected CLOCK minute value after first colon.'
        );

        if (!minutes) {
            return undefined;
        }

        if (!this.expectColon("Expected ':' after CLOCK minute value.")) {
            return undefined;
        }

        const seconds = this.expectNumberLiteral(
            'Expected CLOCK second value after second colon.'
        );

        if (!seconds) {
            return undefined;
        }

        const secondsText = this.tokenText(seconds);

        if (!/^\d+(?:\.\d+)?$/.test(secondsText)) {
            this.problems.error(
                this.location(seconds),
                'CLOCK seconds must be an integer or a decimal fraction without exponent.'
            );
            return undefined;
        }

        return new ClockConstantNode(
            hours,
            this.tokenValue(minutes),
            this.tokenValue(seconds)
        );
    }
}
