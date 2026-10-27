// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DclDationAttributeNode } from '../../../ast/problem/declarations/dclDationAttributeNode';
import { ParserBase } from '../../parserBase';
import { GlobalAttributeParser } from './globalAttributeParser';

/** The CREATED name is a reference to a system-dation specification, not a new declaration. */
export class DclDationAttributeParser extends ParserBase {
    override parse(): DclDationAttributeNode | undefined {
        this.skipTrivia();
        const keyword = this.acceptKeyword('DATION');
        if (!keyword) return undefined;

        const direction = this.expectKeyword(
            ['IN', 'OUT', 'INOUT'],
            "Expected 'IN', 'OUT' or 'INOUT' after 'DATION'."
        );
        const dationClass = this.expectKeyword(
            ['ALPHIC', 'BASIC', 'ALL'],
            'Expected DATION class (ALPHIC, BASIC or ALL).'
        );

        let controlKeyword;
        let controlAll;
        this.skipTrivia();
        const controlToken = this.acceptKeyword('CONTROL');
        if (controlToken) {
            controlKeyword = this.tokenValue(controlToken);
            this.expectLeftParenthesis("Expected '(' after 'CONTROL'.");
            const all = this.expectKeyword('ALL', "Expected 'ALL' in CONTROL attribute.");
            controlAll = all ? this.tokenValue(all) : undefined;
            this.expectRightParenthesis("Expected ')' after 'CONTROL(ALL'.");
        }

        const global = new GlobalAttributeParser(this.context).parse();
        const createdToken = this.expectKeyword('CREATED', "Expected 'CREATED' in DATION declaration.");
        let systemDation;
        if (createdToken) {
            this.expectLeftParenthesis("Expected '(' after 'CREATED'.");
            const identifier = this.expectIdentifier('Expected system DATION name in CREATED(...).');
            systemDation = identifier ? this.tokenValue(identifier) : undefined;
            this.expectRightParenthesis("Expected ')' after CREATED system DATION name.");
        }

        return new DclDationAttributeNode(
            this.tokenValue(keyword),
            direction ? this.tokenValue(direction) : undefined,
            dationClass ? this.tokenValue(dationClass) : undefined,
            controlKeyword,
            controlAll,
            global,
            createdToken ? this.tokenValue(createdToken) : undefined,
            systemDation
        );
    }
}
