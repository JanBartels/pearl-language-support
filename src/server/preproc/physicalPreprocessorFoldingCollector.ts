// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { Source } from '../source/source';
import type { Token } from '../lexer/token';
import { TokenKind } from '../lexer/token';
import { createExclusiveFoldingRegion } from '../folding/foldingRegion';
import { FoldingRegionCollection } from '../folding/foldingRegionCollection';

interface OpenConditional {
    readonly ifToken: Token;
    elseToken?: Token;
}

/**
 * Collect folding structure from the physical source, without evaluating
 * macros or consulting a translation unit / include occurrence.
 *
 * The lexer prevents directive-like text in comments, strings and opaque
 * #define replacements from being treated as structural directives.
 * Unmatched directives are ignored; compiler diagnostics remain the
 * responsibility of the ordinary preprocessor analysis.
 */
export class PhysicalPreprocessorFoldingCollector {
    static collect(source: Source, tokens: readonly Token[], regions: FoldingRegionCollection): void {
        const stack: OpenConditional[] = [];
        for (const token of tokens) {
            if (token.kind !== TokenKind.PreprocessorDirective
                || token.location.source !== source) continue;

            const directive = source.getText(token.location.span);
            switch (directive) {
                case '#ifdef':
                case '#ifndef':
                    stack.push({ ifToken: token });
                    break;
                case '#else': {
                    const current = stack[stack.length - 1];
                    if (current && !current.elseToken) current.elseToken = token;
                    break;
                }
                case '#endif': {
                    const current = stack.pop();
                    if (!current) break;
                    const first = createExclusiveFoldingRegion(
                        current.ifToken.location,
                        (current.elseToken ?? token).location
                    );
                    if (first) regions.add(first);
                    if (current.elseToken) {
                        const second = createExclusiveFoldingRegion(
                            current.elseToken.location, token.location
                        );
                        if (second) regions.add(second);
                    }
                    break;
                }
            }
        }
    }
}
