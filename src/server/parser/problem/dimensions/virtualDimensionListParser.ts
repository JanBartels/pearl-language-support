// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { VirtualDimensionListNode } from '../../../ast/problem/dimensions/virtualDimensionListNode';
import { ParserBase } from '../../parserBase';

export class VirtualDimensionListParser extends ParserBase {
    override parse(): VirtualDimensionListNode | undefined {
        this.skipTrivia();

        if (!this.acceptLeftParenthesis()) {
            return undefined;
        }

        // virtuelle-Dimensionsliste ::= ( [ , ... ] )
        let rank = 1;
        while (this.acceptComma()) {
            rank++;
        }

        this.expectRightParenthesis("Expected ')' after virtual dimension list.");
        return new VirtualDimensionListNode(rank);
    }
}
