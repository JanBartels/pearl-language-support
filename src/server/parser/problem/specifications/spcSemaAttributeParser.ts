// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ParserBase } from '../../parserBase';

import { SpcSemaAttributeNode } from '../../../ast/problem/specifications/spcSemaAttributeNode';

import { GlobalAttributeParser } from '../declarations/globalAttributeParser';
import { ConstantFixedExpressionParser } from '../expressions/constantFixedExpressionParser';

export class SpcSemaAttributeParser extends ParserBase {
    override parse(): SpcSemaAttributeNode | undefined {
        this.skipTrivia();

        const keyword = this.acceptKeyword('SEMA');
        if (!keyword) {
            return undefined;
        }

        let global = new GlobalAttributeParser(this.context).parse();

        this.skipTrivia();
        const preset = this.acceptKeyword('PRESET');
        if (preset) {
            this.problems.error(this.location(preset), 'PRESET attribute is not allowed in SPC.');
            this.consumePresetValues();

            if (!global) {
                global = new GlobalAttributeParser(this.context).parse();
            }
        }

        return new SpcSemaAttributeNode(this.tokenValue(keyword), global);
    }

    private consumePresetValues(): void {
        if (!this.expectLeftParenthesis("Expected '(' after PRESET.")) {
            return;
        }

        const first = new ConstantFixedExpressionParser(this.context).parse();
        if (!first) {
            this.problems.error(this.location(), 'Expected constant FIXED expression in PRESET.');
            this.synchronize([')', 'GLOBAL', ';', 'TYPE', 'DCL', 'DECLARE', 'SPC', 'SPECIFY', 'MODEND']);
            this.acceptRightParenthesis();
            return;
        }

        while (this.acceptComma()) {
            if (new ConstantFixedExpressionParser(this.context).parse()) {
                continue;
            }

            this.problems.error(this.location(), "Expected constant FIXED expression after ','.");
            this.synchronize([')', 'GLOBAL', ';', 'TYPE', 'DCL', 'DECLARE', 'SPC', 'SPECIFY', 'MODEND']);
            break;
        }

        this.expectRightParenthesis("Expected ')' after PRESET list.");
    }
}
