// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SpcInterruptAttributeNode } from '../../../ast/problem/specifications/spcInterruptAttributeNode';
import { ParserBase } from '../../parserBase';
import { GlobalAttributeParser } from '../declarations/globalAttributeParser';

export class SpcInterruptAttributeParser extends ParserBase {
    override parse(): SpcInterruptAttributeNode | undefined {
        this.skipTrivia();

        const keyword = this.acceptKeyword('INTERRUPT');
        if (!keyword) {
            return undefined;
        }

        const global = new GlobalAttributeParser(this.context).parse();
        return new SpcInterruptAttributeNode(this.tokenValue(keyword), global);
    }
}
