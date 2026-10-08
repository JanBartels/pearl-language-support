// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { TailParser } from '../../tailParser';
import {
    ConstantFixedExpressionNode,
    ConstantFixedExpressionTail
} from '../../../ast/problem/expressions/constantFixedExpressionNode';
import { ConstantFixedTermNode } from '../../../ast/problem/expressions/constantFixedTermNode';
import { ConstantFixedTermParser } from './constantFixedTermParser';

export class ConstantFixedExpressionTailParser extends TailParser {
    parseTail(firstTerm: ConstantFixedTermNode): ConstantFixedExpressionNode {
        const tails: ConstantFixedExpressionTail[] = [];

        while (true) {
            this.skipTrivia();

            const operator = this.acceptOperator(['+', '-']);

            if (!operator) {
                break;
            }

            const term = new ConstantFixedTermParser(this.context).parse();

            if (!term) {
                this.problems.error(
                    this.location(),
                    `Expected constant FIXED term after '${this.tokenText(operator)}'.`
                );
                break;
            }

            tails.push({
                operator: this.tokenValue(operator),
                term
            });
        }

        return new ConstantFixedExpressionNode(firstTerm, tails);
    }
}
