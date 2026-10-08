// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../core/sourceValue';
import { CompilerModeNode } from '../../ast/module/compilerModeNode';
import { ParserBase } from '../parserBase';

/**
 * Parses the RTOS-UH module-global compiler mode statement:
 *
 *   MODE=<identifier>;
 *
 * The parser intentionally accepts the mode name syntactically without
 * interpreting it. Supported mode names and their effects belong to semantic
 * analysis, not to the grammar.
 */
export class CompilerModeParser extends ParserBase {
    override parse(): CompilerModeNode | undefined {
        this.skipTrivia();

        const keyword = this.acceptKeyword('MODE');
        if (!keyword) {
            return undefined;
        }

        if (!this.expectEquals("Expected '=' after 'MODE'.")) {
            this.synchronize([';', 'MODULE', 'SHELLMODULE']);
            this.acceptSemicolon();
            return new CompilerModeNode(
                this.tokenValue(keyword),
                SourceValue.synthetic('<error>')
            );
        }

        const modeToken = this.expectIdentifier('Expected compiler mode after MODE=.');
        if (!modeToken) {
            this.synchronize([';', 'MODULE', 'SHELLMODULE']);
            this.acceptSemicolon();
            return new CompilerModeNode(
                this.tokenValue(keyword),
                SourceValue.synthetic('<error>')
            );
        }

        if (!this.expectSemicolon()) {
            this.synchronize([';', 'MODULE', 'SHELLMODULE']);
            this.acceptSemicolon();
        }

        return new CompilerModeNode(
            this.tokenValue(keyword),
            this.tokenValue(modeToken)
        );
    }
}
