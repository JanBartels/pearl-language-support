// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ParserBase } from '../../parserBase';
import { ConstantFixedExpressionNode } from '../../../ast/problem/expressions/constantFixedExpressionNode';
import { ConstantFixedTermParser } from './constantFixedTermParser';
import { ConstantFixedExpressionTailParser } from './constantFixedExpressionTailParser';

export class ConstantFixedExpressionParser extends ParserBase {
    override parse(): ConstantFixedExpressionNode | undefined {
        this.skipTrivia();

        const firstTerm = new ConstantFixedTermParser(this.context).parse();

        if (!firstTerm) {
            return undefined;
        }

        return new ConstantFixedExpressionTailParser(this.context).parseTail(firstTerm);
    }
}
