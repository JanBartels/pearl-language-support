// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { TailParser } from '../../tailParser';
import {
    ConstantFixedTermNode,
    ConstantFixedTermTail
} from '../../../ast/problem/expressions/constantFixedTermNode';
import { ConstantFixedFactorNode } from '../../../ast/problem/expressions/constantFixedFactorNode';
import { ConstantFixedFactorParser } from './constantFixedFactorParser';

export class ConstantFixedTermTailParser extends TailParser {
    parseTail(firstFactor: ConstantFixedFactorNode): ConstantFixedTermNode {
        const tails: ConstantFixedTermTail[] = [];

        while (true) {
            this.skipTrivia();

            const operator = this.acceptOperator(['*', '//'])
                ?? this.acceptKeyword('REM');

            if (!operator) {
                break;
            }

            const factor = new ConstantFixedFactorParser(this.context).parse();

            if (!factor) {
                this.problems.error(
                    this.location(),
                    `Expected constant FIXED factor after '${this.tokenText(operator)}'.`
                );
                break;
            }

            tails.push({
                operator: this.tokenValue(operator),
                factor
            });
        }

        return new ConstantFixedTermNode(firstFactor, tails);
    }
}
