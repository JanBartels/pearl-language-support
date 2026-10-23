// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../core/sourceValue';
import { ModuleSizeSettingNode } from '../../ast/module/moduleSizeSettingNode';
import { ParserBase } from '../parserBase';

/** S/SC=<hex> [,CODE=<hex>,VAR=<hex>] ;  (hex optionally prefixed with '$') */
export class ModuleSizeSettingParser extends ParserBase {
    override parse(): ModuleSizeSettingNode | undefined {
        this.skipTrivia();
        const keyword = this.acceptKeyword(['S', 'SC']);
        if (!keyword) return undefined;
        const word = this.tokenValue(keyword);
        const error = SourceValue.synthetic('<error>');
        if (!this.expectEquals(`Expected '=' after '${word.value}'.`)) {
            this.synchronizeSetting();
            return new ModuleSizeSettingNode(word, error);
        }

        const size = this.parseSizeHex();
        if (!size) {
            this.synchronizeSetting();
            return new ModuleSizeSettingNode(word, error);
        }

        let codeKeyword: SourceValue<string> | undefined;
        let codeAddress: SourceValue<string> | undefined;
        let varKeyword: SourceValue<string> | undefined;
        let varAddress: SourceValue<string> | undefined;

        if (this.acceptComma()) {
            this.skipTrivia();
            const code = this.expectKeyword('CODE', "Expected 'CODE' after ','.");
            codeKeyword = code ? this.tokenValue(code) : error;
            if (!this.expectEquals("Expected '=' after CODE.")) {
                this.synchronizeSetting();
                return new ModuleSizeSettingNode(word, size, codeKeyword, error);
            }
            codeAddress = this.parseSizeHex() ?? error;
            if (!this.expectComma("Expected ',' before VAR.")) {
                this.synchronizeSetting();
                return new ModuleSizeSettingNode(word, size, codeKeyword, codeAddress);
            }
            const variable = this.expectKeyword('VAR', "Expected 'VAR' after ','.");
            varKeyword = variable ? this.tokenValue(variable) : error;
            if (!this.expectEquals("Expected '=' after VAR.")) {
                this.synchronizeSetting();
                return new ModuleSizeSettingNode(word, size, codeKeyword, codeAddress, varKeyword, error);
            }
            varAddress = this.parseSizeHex() ?? error;
        }

        if (!this.expectSemicolon()) this.synchronizeSetting();
        return new ModuleSizeSettingNode(word, size, codeKeyword, codeAddress, varKeyword, varAddress);
    }

    private parseSizeHex(): SourceValue<string> | undefined {
        this.skipTrivia();
        const token = this.acceptHexLiteral()
            ?? this.acceptIntegerLiteral()
            ?? this.acceptHexDigitSequence();
        if (token) return this.tokenValue(token);

        // E in 2E570 is lexically an exponent, but here the entire token
        // denotes a hexadecimal number. Hex-only identifiers (e.g. FACE)
        // are also accepted only in this grammatical position.
        if ((this.isFloatingPointLiteral() || this.isIdentifier())
            && /^[0-9A-Fa-f]+$/.test(this.tokenText())) {
            const hexToken = this.current();
            this.next();
            return this.tokenValue(hexToken);
        }
        this.problems.error(this.location(), 'Expected hexadecimal number (e.g. $6500 or 6500).');
        return undefined;
    }

    private synchronizeSetting(): void {
        this.synchronize([';', 'MODULE', 'SHELLMODULE']);
        this.acceptSemicolon();
    }
}
