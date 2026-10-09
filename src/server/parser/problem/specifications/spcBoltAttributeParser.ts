// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SpcBoltAttributeNode } from '../../../ast/problem/specifications/spcBoltAttributeNode';
import { ParserBase } from '../../parserBase';
import { GlobalAttributeParser } from '../declarations/globalAttributeParser';

export class SpcBoltAttributeParser extends ParserBase {
    override parse(): SpcBoltAttributeNode | undefined {
        this.skipTrivia();

        const keyword = this.acceptKeyword('BOLT');
        if (!keyword) {
            return undefined;
        }

        const global = new GlobalAttributeParser(this.context).parse();
        return new SpcBoltAttributeNode(this.tokenValue(keyword), global);
    }
}
