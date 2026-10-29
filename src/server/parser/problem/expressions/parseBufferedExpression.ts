// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Token, TokenKind } from '../../../lexer/token';
import type { TokenStream } from '../../../lexer/tokenStream';
import type { Span } from '../../../core/span';
import type { ExpressionNode } from '../../../ast/problem/expressions/expressionNode';
import { ProblemCollection } from '../../../core/problemCollection';
import type { ParserContext } from '../../parserContext';
import { ParserContext as ExpressionParserContext } from '../../parserContext';
import { ExpressionParser } from './expressionParser';

/** A finite view of original, already preprocessed tokens, including their
 * original source locations (which may belong to macro expansions).
 * No re-lexing and no second expression grammar are involved.
 */
class BufferedTokenStream implements TokenStream {
    private position = 0;
    private readonly eofToken: Token;

    constructor(private readonly tokens: readonly Token[]) {
        const last = tokens[tokens.length - 1]!;
        this.eofToken = { kind: TokenKind.EOF, location: last.location };
    }

    current(): Token { return this.peek(); }
    peek(offset = 0): Token { return this.tokens[this.position + offset] ?? this.eofToken; }
    next(): void { if (!this.eof()) this.position++; }
    eof(): boolean { return this.position >= this.tokens.length; }
    tokenText(token: Token): string {
        return token.kind === TokenKind.EOF ? ''
            : token.location.source.getText(token.location.span);
    }
    getText(span: Span): string { return this.tokens[0]!.location.source.getText(span); }
}

/**
 * Transitional integration for statement headers still stored as token lists.
 * Only completely supported expressions are attached to the AST. For syntax
 * not yet handled by ExpressionParser, retain the existing token-only statement
 * rather than reporting speculative parser/semantic errors. Definite syntax
 * violations must nevertheless be reported, even when the buffered parse
 * falls back to the original tokens.
 */
export function parseBufferedExpression(
    tokens: readonly Token[], context: ParserContext
): ExpressionNode | undefined {
    if (!tokens.length) return undefined;

    // A buffered parse may stop at an unsupported token and intentionally
    // discard tentative parser errors. Unlike unsupported expression forms,
    // assignment operators are never valid within an expression. Diagnose
    // them at their original locations (including preprocessor expansions)
    // before falling back, rather than silently accepting "IF X = 0 THEN".
    let invalidAssignment = false;
    for (const token of tokens) {
        if (token.kind === TokenKind.Identifier
            && token.location.source.getText(token.location.span) === 'IF') {
            context.problems.error(token.location.source.mapLocation(token.location),
                'Bedingte IF-Ausdrücke werden von RTOS-UH nicht unterstützt.');
            invalidAssignment = true;
        }
        if (token.kind !== TokenKind.Operator) continue;
        const operator = token.location.source.getText(token.location.span);
        if (operator !== '=' && operator !== ':=') continue;
        const detail = operator === '=' ? " Für Vergleiche '==' verwenden." : '';
        context.problems.error(token.location.source.mapLocation(token.location),
            `Operator '${operator}' ist in einem Ausdruck nicht zulässig.${detail}`);
        invalidAssignment = true;
    }
    if (invalidAssignment) return undefined;

    const problems = new ProblemCollection();
    const stream = new BufferedTokenStream(tokens);
    const parserContext = new ExpressionParserContext(stream, problems, context.logger);
    const expression = new ExpressionParser(parserContext).parse();
    return expression && stream.eof() && problems.isEmpty() ? expression : undefined;
}
