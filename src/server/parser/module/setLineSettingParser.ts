// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../core/sourceValue';
import { SetLineSettingNode } from '../../ast/module/setLineSettingNode';
import { ParserBase } from '../parserBase';

/** SETLINE=<first-line>[,<module-id>]; */
export class SetLineSettingParser extends ParserBase {
    override parse(): SetLineSettingNode | undefined {
        this.skipTrivia();
        const keyword = this.acceptKeyword('SETLINE');
        if (!keyword) return undefined;
        const word = this.tokenValue(keyword);
        const error = SourceValue.synthetic('<error>');
        if (!this.expectEquals("Expected '=' after SETLINE.")) {
            this.synchronizeSetting();
            return new SetLineSettingNode(word, error);
        }
        const first = this.expectIntegerLiteral('Expected first line number after SETLINE=.');
        if (!first) {
            this.synchronizeSetting();
            return new SetLineSettingNode(word, error);
        }
        let moduleId: SourceValue<string> | undefined;
        if (this.acceptComma()) {
            const id = this.expectIntegerLiteral('Expected module ID after comma.');
            moduleId = id ? this.tokenValue(id) : error;
        }
        if (!this.expectSemicolon()) this.synchronizeSetting();
        return new SetLineSettingNode(word, this.tokenValue(first), moduleId);
    }

    private synchronizeSetting(): void {
        this.synchronize([';', 'MODULE', 'SHELLMODULE']);
        this.acceptSemicolon();
    }
}
