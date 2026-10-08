// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../core/sourceValue';
import { AstNode } from '../astNode';
import { AstKind } from '../astKind';
import { AstLookupResult } from '../astLookupResult';
import { DocumentationProvider } from '../../documentation/documentationProvider';
import { CompilerModeDocumentationProvider } from '../../documentation/module/compilerModeDocumentationProvider';

/**
 * RTOS-UH compiler mode statement in the translation-unit preamble.
 *
 * Example:
 *
 *   MODE=NOLSTOP;
 *   MODULE Test;
 *
 * The AST deliberately stores only the written syntax. The effect of the mode
 * on a module is determined by semantic analysis.
 */
export class CompilerModeNode extends AstNode {
    private static readonly provider = new CompilerModeDocumentationProvider();

    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly mode: SourceValue<string>
    ) {
        super(AstKind.CompilerMode);
    }

    override documentationProvider(): DocumentationProvider<CompilerModeNode> {
        return CompilerModeNode.provider;
    }

    override lookupSourceValue(offset: number): AstLookupResult | undefined {
        return this.lookupOwnSourceValue(offset, this.keyword)
            ?? this.lookupOwnSourceValue(offset, this.mode);
    }

    override dumpLabel(): string {
        return `CompilerMode(${this.mode.value})`;
    }
}
