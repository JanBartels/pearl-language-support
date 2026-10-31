// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { Location } from '../core/location';
import type { Source } from '../source/source';
import { TokenKind } from '../lexer/token';
import type { TokenStream } from '../lexer/tokenStream';
import type { MacroReference } from './macroReference';
import type { PreprocessorConditionalBlock } from './preprocessorConditionalBlock';
import { ExternalPreprocessorResultBuilder, type ExternalPreprocessorResult } from './externalPreprocessorResult';

/**
 * Transitional adapter for the existing token-based external preprocessor.
 *
 * It preserves original whitespace between adjacent emitted tokens from the
 * same source, but NEVER copies skipped directives, inactive regions, or
 * macro invocations back into the output. It is intentionally not the final
 * macro expander: lexically incomplete replacements still require the planned
 * character-level expansion before compiler lexing.
 */
export function collectExternalPreprocessorText(
    stream: TokenStream,
    root: Source,
    macroReferences: readonly MacroReference[] = [],
    conditionalBlocks: readonly PreprocessorConditionalBlock[] = []
): ExternalPreprocessorResult {
    const builder = new ExternalPreprocessorResultBuilder(root);
    for (const reference of macroReferences) builder.addMacroReference(reference);
    for (const block of conditionalBlocks) builder.addConditionalBlock(block);

    let previous: Location | undefined;
    while (!stream.eof()) {
        const token = stream.current();
        if (token.kind === TokenKind.EOF) break;
        const location = token.location;
        const text = stream.tokenText(token);

        // Only recover gaps which are *entirely* whitespace. A skipped
        // directive or inactive branch must never be resurrected.
        if (previous && previous.source === location.source &&
            previous.span.end <= location.span.start) {
            const gap: Location = {
                source: location.source,
                span: { start: previous.span.end, end: location.span.start }
            };
            const gapText = gap.source.getText(gap.span);
            if (/^\s*$/.test(gapText)) builder.appendOriginal(gap);
        }

        // An expansion token is located in a MacroSource. Its mapLocation
        // anchors it to the invocation; appending as a direct source slice
        // preserves the original mapping chain.
        if (location.source.getText(location.span) === text) {
            builder.appendOriginal(location);
        } else {
            builder.appendExpansion(text, location);
        }
        previous = location;
        stream.next();
    }
    return builder.build();
}
