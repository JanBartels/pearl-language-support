// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SpcDationAttributeNode } from '../../../ast/problem/specifications/spcDationAttributeNode';
import { ParserBase } from '../../parserBase';
import { GlobalAttributeParser } from '../declarations/globalAttributeParser';

export class SpcDationAttributeParser extends ParserBase {
    override parse(): SpcDationAttributeNode | undefined {
        this.skipTrivia();

        const keyword = this.acceptKeyword('DATION');
        if (!keyword) {
            return undefined;
        }

        this.skipTrivia();
        const direction = this.expectKeyword(
            ['IN', 'OUT', 'INOUT'],
            "Expected 'IN', 'OUT' or 'INOUT' after 'DATION'."
        );

        this.skipTrivia();
        const dationClass = this.expectKeyword(
            ['ALPHIC', 'BASIC', 'ALL'],
            "Expected 'ALPHIC', 'BASIC' or 'ALL' as DATION class."
        );

        let controlKeyword;
        let controlAll;

        this.skipTrivia();
        const controlToken = this.acceptKeyword('CONTROL');
        if (controlToken) {
            controlKeyword = this.tokenValue(controlToken);
            this.expectLeftParenthesis("Expected '(' after 'CONTROL'.");

            const allToken = this.expectKeyword('ALL', "Expected 'ALL' in CONTROL attribute.");
            controlAll = allToken ? this.tokenValue(allToken) : undefined;

            this.expectRightParenthesis("Expected ')' after 'CONTROL(ALL'.");
        }

        const global = new GlobalAttributeParser(this.context).parse();

        return new SpcDationAttributeNode(
            this.tokenValue(keyword),
            direction ? this.tokenValue(direction) : undefined,
            dationClass ? this.tokenValue(dationClass) : undefined,
            controlKeyword,
            controlAll,
            global
        );
    }
}
