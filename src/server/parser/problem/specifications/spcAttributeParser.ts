// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SpcAttributeNode } from '../../../ast/problem/specifications/spcAttributeNode';
import { ParserBase } from '../../parserBase';
import { SpcBoltAttributeParser } from './spcBoltAttributeParser';
import { SpcDationAttributeParser } from './spcDationAttributeParser';
import { SpcInterruptAttributeParser } from './spcInterruptAttributeParser';
import { SpcProblemDataAttributeParser } from './spcProblemDataAttributeParser';
import { SpcSemaAttributeParser } from './spcSemaAttributeParser';

export class SpcAttributeParser extends ParserBase {
    override parse(): SpcAttributeNode | undefined {
        this.skipTrivia();

        return new SpcSemaAttributeParser(this.context).parse()
            ?? new SpcBoltAttributeParser(this.context).parse()
            ?? new SpcDationAttributeParser(this.context).parse()
            ?? new SpcInterruptAttributeParser(this.context).parse()
            ?? new SpcProblemDataAttributeParser(this.context).parse();
    }
}
