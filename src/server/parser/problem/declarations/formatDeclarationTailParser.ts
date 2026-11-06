// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { FormatDeclarationNode } from '../../../ast/problem/declarations/formatDeclarationNode';
import type { SourceValue } from '../../../core/sourceValue';
import { ParserBase } from '../../parserBase';
import { FormatListParser } from '../statements/formatListParser';

/** Parses Name: FORMAT (formats); after Name and ':' were accepted. */
export class FormatDeclarationTailParser extends ParserBase {
    override parse(): FormatDeclarationNode | undefined {
        throw new Error('Use parseTail().');
    }
    parseTail(name: SourceValue<string>, colon: SourceValue<string> | undefined): FormatDeclarationNode | undefined {
        this.skipTrivia();
        const keyword = this.acceptKeyword('FORMAT');
        if (!keyword) return undefined;
        this.skipTrivia();
        const formats = new FormatListParser(this.context, true).parseParenthesized();
        this.skipTrivia();
        const semicolon = this.acceptOperator(';');
        if (!semicolon) {
            this.problems.error(this.location(), "Expected ';' after FORMAT declaration.");
            this.synchronize([';', 'DCL', 'TYPE', 'SPC', 'END', 'MODEND']);
            this.acceptOperator(';');
        }
        return new FormatDeclarationNode(name, colon, this.tokenValue(keyword), formats,
            semicolon ? this.tokenValue(semicolon) : undefined);
    }
}
