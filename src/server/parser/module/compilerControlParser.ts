// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstNode } from '../../ast/astNode';
import { ParserBase } from '../parserBase';
import { CompilerModeParser } from './compilerModeParser';
import { ProcessorSettingParser } from './processorSettingParser';
import { ModuleSizeSettingParser } from './moduleSizeSettingParser';
import { SetLineSettingParser } from './setLineSettingParser';
import { MaxErrorSettingParser } from './maxErrorSettingParser';

/** LL(1) dispatch for RTOS-UH compiler controls before MODULE/SHELLMODULE. */
export class CompilerControlParser extends ParserBase {
    override parse(): AstNode | undefined {
        this.skipTrivia();

        if (this.isKeyword('MODE')) {
            return new CompilerModeParser(this.context).parse();
        }
        if (this.isKeyword('P')) {
            return new ProcessorSettingParser(this.context).parse();
        }
        if (this.isKeyword(['S', 'SC'])) {
            return new ModuleSizeSettingParser(this.context).parse();
        }
        if (this.isKeyword('SETLINE')) {
            return new SetLineSettingParser(this.context).parse();
        }
        if (this.isKeyword('MAXERR')) {
            return new MaxErrorSettingParser(this.context).parse();
        }
        return undefined;
    }
}
