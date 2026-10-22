// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../core/sourceValue';
import { MaxErrorSettingNode } from '../../ast/module/maxErrorSettingNode';
import { ParserBase } from '../parserBase';

/** MAXERR=<nonnegative integer>; */
export class MaxErrorSettingParser extends ParserBase {
    override parse(): MaxErrorSettingNode | undefined {
        this.skipTrivia();
        const keyword = this.acceptKeyword('MAXERR');
        if (!keyword) return undefined;
        const word = this.tokenValue(keyword);
        const error = SourceValue.synthetic('<error>');
        if (!this.expectEquals("Expected '=' after MAXERR.")) {
            this.synchronizeSetting();
            return new MaxErrorSettingNode(word, error);
        }
        const maximum = this.expectIntegerLiteral('Expected maximum number of errors after MAXERR=.');
        if (!maximum) {
            this.synchronizeSetting();
            return new MaxErrorSettingNode(word, error);
        }
        if (!this.expectSemicolon()) this.synchronizeSetting();
        return new MaxErrorSettingNode(word, this.tokenValue(maximum));
    }

    private synchronizeSetting(): void {
        this.synchronize([';', 'MODULE', 'SHELLMODULE']);
        this.acceptSemicolon();
    }
}
