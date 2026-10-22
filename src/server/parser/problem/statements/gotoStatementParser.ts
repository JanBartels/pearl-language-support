// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { GotoStatementNode } from '../../../ast/problem/statements/gotoStatementNode';
import { ParserBase } from '../../parserBase';

export class GotoStatementParser extends ParserBase {
    override parse(): GotoStatementNode | undefined {
        this.skipTrivia();
        const keyword = this.acceptKeyword('GOTO');
        if (!keyword) return undefined;

        this.skipTrivia();
        const target = this.expectIdentifier("Expected label after 'GOTO'.");

        this.skipTrivia();
        if (!this.expectSemicolon("Expected ';' after GOTO.")) {
            this.synchronize([';', 'END', 'MODEND', 'FIN', 'ELSE', 'ALT', 'OUT']);
            this.acceptSemicolon();
        }

        return new GotoStatementNode(
            this.tokenValue(keyword),
            target ? this.tokenValue(target) : undefined
        );
    }
}
