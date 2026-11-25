// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { TokenKind, isCommentToken, type Token } from '../lexer/token';
import type { Location } from '../core/location';

/** Recognize only a canonical whole-file guard in the physical lexer tokens.
 * No macro state is consulted and inactive branches are not discarded.
 * Return the exact defining identifier, never just the macro name.
 */
export function detectIncludeGuard(tokens: readonly Token[]): Location | undefined {
    const text = (token: Token) => token.location.source.getText(token.location.span);
    let index = 0;
    const nextLine = (): Token[] | undefined => {
        while (index < tokens.length) {
            const line: Token[] = [];
            while (index < tokens.length) {
                const token = tokens[index++]!;
                if (token.kind === TokenKind.Newline || token.kind === TokenKind.EOF) break;
                line.push(token);
            }
            const ordinaryComment = (token: Token) => isCommentToken(token) && !token.compilerOption();
            let start = 0;
            let end = line.length;
            while (start < end && ordinaryComment(line[start]!)) start++;
            while (end > start && ordinaryComment(line[end - 1]!)) end--;
            if (start < end) return line.slice(start, end);
        }
        return undefined;
    };
    const isDirective = (token: Token | undefined, name: string): boolean =>
        token?.kind === TokenKind.PreprocessorDirective && text(token) === name;
    const first = nextLine();
    if (first?.length !== 2 || !isDirective(first[0], '#ifndef') ||
        first[1]?.kind !== TokenKind.Identifier) return undefined;
    const name = text(first[1]);
    const second = nextLine();
    if (second?.length !== 2 || !isDirective(second[0], '#define') ||
        second[1]?.kind !== TokenKind.Identifier || text(second[1]) !== name) return undefined;
    const definition = second[1].location;
    let depth = 1;
    for (let line = nextLine(); line; line = nextLine()) {
        // Directives embedded in ordinary source are not a canonical guard.
        if (line.slice(1).some(token => token.kind === TokenKind.PreprocessorDirective ||
            token.kind === TokenKind.InvalidDirective)) return undefined;
        if (isDirective(line[0], '#ifdef') || isDirective(line[0], '#ifndef')) {
            if (line.length !== 2 || line[1]?.kind !== TokenKind.Identifier) return undefined;
            depth++;
        } else if (isDirective(line[0], '#else')) {
            if (depth === 1 || line.length !== 1) return undefined;
        } else if (isDirective(line[0], '#endif')) {
            if (line.length !== 1) return undefined;
            if (--depth === 0) return nextLine() === undefined ? definition : undefined;
        } else if ((isDirective(line[0], '#undef') || isDirective(line[0], '#define')) &&
            line[1] && text(line[1]) === name) {
            // A guard that is explicitly changed inside its own body is ambiguous.
            return undefined;
        }
    }
    return undefined;
}
