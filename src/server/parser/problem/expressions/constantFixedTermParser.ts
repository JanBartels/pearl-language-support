// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ParserBase } from '../../parserBase';
import { ConstantFixedTermNode } from '../../../ast/problem/expressions/constantFixedTermNode';
import { ConstantFixedFactorParser } from './constantFixedFactorParser';
import { ConstantFixedTermTailParser } from './constantFixedTermTailParser';

export class ConstantFixedTermParser extends ParserBase {
    override parse(): ConstantFixedTermNode | undefined {
        this.skipTrivia();

        const firstFactor = new ConstantFixedFactorParser(this.context).parse();

        if (!firstFactor) {
            return undefined;
        }

        return new ConstantFixedTermTailParser(this.context).parseTail(firstFactor);
    }
}
