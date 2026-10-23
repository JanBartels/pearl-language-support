// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../core/sourceValue';
import { ProcessorSettingNode } from '../../ast/module/processorSettingNode';
import { ParserBase } from '../parserBase';

/** RTOS-UH P=<CPU> [ +(n) | +FPU(n) | (n) ]; options checked by semantics. */
export class ProcessorSettingParser extends ParserBase {
    override parse(): ProcessorSettingNode | undefined {
        this.skipTrivia();
        const keyword = this.acceptKeyword('P');
        if (!keyword) return undefined;
        const keywordValue = this.tokenValue(keyword);
        const error = SourceValue.synthetic('<error>');

        if (!this.expectEquals("Expected '=' after 'P'.")) {
            this.synchronizeSetting();
            return new ProcessorSettingNode(keywordValue, error);
        }

        this.skipTrivia();
        const name = this.acceptIntegerLiteral() ?? this.acceptIdentifier();
        if (!name) {
            this.problems.error(this.location(), 'Expected processor designation after P=.');
            this.synchronizeSetting();
            return new ProcessorSettingNode(keywordValue, error);
        }

        let fpuKeyword: SourceValue<string> | undefined;
        let registerCount: SourceValue<string> | undefined;
        let plusOperator: SourceValue<string> | undefined;

        this.skipTrivia();

        // PowerPC special form: MPC604+FPU(n)
        const plus = this.acceptOperator('+');
        if (plus) {
            plusOperator = this.tokenValue(plus);
            this.skipTrivia();
            const fpu = this.acceptKeyword('FPU');
            if (fpu) fpuKeyword = this.tokenValue(fpu);
            if (!this.expectLeftParenthesis()) {
                this.synchronizeSetting();
                return new ProcessorSettingNode(keywordValue, this.tokenValue(name), fpuKeyword, error, plusOperator);
            }
            registerCount = this.parseRegisterCount();
        } else if (this.acceptLeftParenthesis()) {
            // 68040(n), 68060(n), 68881(n)
            registerCount = this.parseRegisterCount();
        }

        this.endSetting();
        return new ProcessorSettingNode(keywordValue, this.tokenValue(name), fpuKeyword, registerCount, plusOperator);
    }

    private parseRegisterCount(): SourceValue<string> {
        const number = this.expectIntegerLiteral('Expected FPU register count.');
        const value = number ? this.tokenValue(number) : SourceValue.synthetic('<error>');
        if (!this.expectRightParenthesis()) {
            this.synchronize([')', ';', 'MODULE', 'SHELLMODULE']);
            this.acceptRightParenthesis();
        }
        return value;
    }

    private endSetting(): void {
        if (!this.expectSemicolon()) this.synchronizeSetting();
    }

    private synchronizeSetting(): void {
        this.synchronize([';', 'MODULE', 'SHELLMODULE']);
        this.acceptSemicolon();
    }
}
