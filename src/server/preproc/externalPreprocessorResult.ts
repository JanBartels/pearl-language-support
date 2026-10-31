// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { Location } from '../core/location';
import type { Source } from '../source/source';
import { ExpandedSource, ExpandedSourceBuilder } from '../source/expandedSource';
import type { MacroReference } from './macroReference';
import type { PreprocessorConditionalBlock } from './preprocessorConditionalBlock';

/**
 * The external preprocessor's complete output.
 *
 * `source` contains PEARL text, not a token stream. A subsequent compiler
 * lexer is responsible for recognizing all tokens and comments, including
 * constructs spanning several macro replacement fragments.
 *
 * Macro references and conditional blocks are editor metadata. They refer
 * to original input locations and must not be reconstructed from output text.
 * The compiler-internal (uppercase) directives are not handled here.
 */
export interface ExternalPreprocessorResult {
    readonly source: ExpandedSource;
    readonly macroReferences: readonly MacroReference[];
    readonly conditionalBlocks: readonly PreprocessorConditionalBlock[];
}

/**
 * Assemble the output in the precise order in which the external preprocessor
 * emits characters. The builder does not interpret PEARL syntax or directives.
 *
 * In particular, it never inserts separators between fragments: `/' followed
 * by `*' must be able to form a block-comment opener in the compiler lexer.
 */
export class ExternalPreprocessorResultBuilder {
    private readonly output: ExpandedSourceBuilder;
    private readonly macroReferences: MacroReference[] = [];
    private readonly conditionalBlocks: PreprocessorConditionalBlock[] = [];

    constructor(root: Source) {
        this.output = new ExpandedSourceBuilder(root);
    }

    /** Copy an unchanged range, including any original whitespace. */
    appendOriginal(location: Location): void {
        this.output.appendOriginal(location);
    }

    /** Append generated replacement characters, anchored to the invocation. */
    appendExpansion(text: string, invocation: Location): void {
        this.output.appendExpansion(text, invocation);
    }

    /** Metadata is emitted during expansion, not inferred from compiler tokens. */
    addMacroReference(reference: MacroReference): void {
        this.macroReferences.push(reference);
    }

    addConditionalBlock(block: PreprocessorConditionalBlock): void {
        this.conditionalBlocks.push(block);
    }

    build(): ExternalPreprocessorResult {
        return {
            source: this.output.build(),
            macroReferences: Object.freeze([...this.macroReferences]),
            conditionalBlocks: Object.freeze([...this.conditionalBlocks])
        };
    }
}
