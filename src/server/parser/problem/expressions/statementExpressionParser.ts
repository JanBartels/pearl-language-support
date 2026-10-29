// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { SourceValue } from '../../../core/sourceValue';
import type { ExpressionNode } from '../../../ast/problem/expressions/expressionNode';
import { TokenKind, type Token } from '../../../lexer/token';
import type { TokenStream } from '../../../lexer/tokenStream';
import type { Span } from '../../../core/span';
import { ParserContext } from '../../parserContext';
import { ProblemCollection } from '../../../core/problemCollection';
import { ParserBase } from '../../parserBase';
import { ExpressionParser } from './expressionParser';

/** Observe the real parser stream while ExpressionParser consumes it.
 * In contrast to BufferedTokenStream, this is NOT a replay or a second parse.
 * Recording serves only the existing token-based AST/documentation views.
 */
class RecordingTokenStream implements TokenStream {
    readonly tokens: Token[] = [];
    constructor(private readonly stream: TokenStream) {}
    current(): Token { return this.stream.current(); }
    peek(offset = 0): Token { return this.stream.peek(offset); }
    next(): void {
        if (!this.stream.eof()) {
            this.tokens.push(this.stream.current());
            this.stream.next();
        }
    }
    eof(): boolean { return this.stream.eof(); }
    tokenText(token: Token): string { return this.stream.tokenText(token); }
    getText(span: Span): string { return this.stream.getText(span); }
}

export interface ParsedStatementExpression {
    readonly expression: ExpressionNode | undefined;
    readonly values: readonly SourceValue<string>[];
}

/** Parse an expression directly from the current statement stream.
 * Stop tokens belong to the enclosing grammar and are never consumed.
 * Incomplete/unsupported syntax is recovered locally without swallowing the
 * following statement or a controlling END/FIN/REPEAT.
 */
export class StatementExpressionParser extends ParserBase {
    override parse(): ExpressionNode | undefined {
        return new ExpressionParser(this.context).parse();
    }

    parseUntil(terminators: readonly string[], description: string): ParsedStatementExpression {
        const recorded = new RecordingTokenStream(this.context.stream);
        const tentative = new ProblemCollection();
        const expressionContext = new ParserContext(recorded, tentative, this.context.logger);
        const expression = new ExpressionParser(expressionContext).parse();
        this.skipTrivia();
        if (!this.isStop(terminators) && !this.eof()) {
            // An unsupported postfix (A[1]) is preserved as raw tokens for
            // compatibility, but no partially parsed expression is attached.
            const unsupported = this.isOperator('[');
            const invalidCount = this.recover(terminators, recorded);
            if (invalidCount === 0 && !unsupported) {
                this.problems.addAll(tentative);
                this.problems.error(this.location(),
                    `Unexpected token in ${description}.`);
            }
            return { expression: undefined, values: this.tokenValues(recorded.tokens) };
        }
        this.problems.addAll(tentative);
        if (!expression && recorded.tokens.every(token => token.kind === TokenKind.Comment
            || token.kind === TokenKind.Newline) && tentative.isEmpty()) {
            this.problems.error(this.location(), `Expected expression in ${description}.`);
        }
        return {
            expression: tentative.isEmpty() ? expression : undefined,
            values: this.tokenValues(recorded.tokens, tentative.isEmpty() ? expression : undefined)
        };
    }

    /** Return the same SourceValues used by the expression AST wherever possible.
     * Existing source lookup tests depend on their identity, not just position.
     */
    private tokenValues(tokens: readonly Token[], expression?: ExpressionNode): SourceValue<string>[] {
        return tokens.filter(token => token.kind !== TokenKind.Comment
            && token.kind !== TokenKind.Newline).map(token => {
            const location = token.location.source.mapLocation(token.location);
            const lookup = expression?.lookupSourceValue({
                uri: location.source.uri, offset: location.span.start
            });
            const value = lookup?.element;
            if (value?.location?.source === location.source
                && value.location.span.start === location.span.start
                && value.location.span.end === location.span.end
                && typeof value.value === 'string') return value as SourceValue<string>;
            return this.tokenValue(token);
        });
    }

    private isStop(terminators: readonly string[]): boolean {
        return terminators.some(term => this.isKeyword(term) || this.isOperator(term))
            || this.isKeyword(['END', 'MODEND', 'FIN', 'ELSE', 'OUT', 'ALT',
                'BEGIN', 'DCL', 'DECLARE', 'TYPE', 'SPC', 'SPECIFY'])
            || this.isOperator(';');
    }

    private recover(terminators: readonly string[], recorded: RecordingTokenStream): number {
        // The expression parser may already have consumed opening brackets
        // before encountering a bad operator. Recovery must close those,
        // rather than leave their ')' to the enclosing statement parser.
        const brackets: string[] = [];
        for (const token of recorded.tokens) {
            const text = recorded.tokenText(token);
            if (text === '(' || text === '[') brackets.push(text);
            else if ((text === ')' || text === ']') && brackets.length) brackets.pop();
        }
        let invalid = 0;
        while (!this.eof()) {
            this.skipTrivia();
            // Never consume a controlling statement boundary, even if the
            // malformed expression contains an unclosed parenthesis.
            if (this.isKeyword(['END', 'MODEND', 'FIN', 'ELSE', 'OUT', 'ALT',
                'BEGIN', 'REPEAT', 'THEN']) || this.isOperator(';')) break;
            if (brackets.length === 0 && this.isStop(terminators)) break;
            const token = this.current();
            const value = this.tokenText(token);
            if (value === '=' || value === ':=') {
                this.problems.error(this.location(token),
                    `Operator '${value}' ist in einem Ausdruck nicht zulässig.${
                        value === '=' ? " Für Vergleiche '==' verwenden." : ''}`);
                invalid++;
            } else if (this.isKeyword('IF')) {
                this.problems.error(this.location(token),
                    'Bedingte IF-Ausdrücke werden von RTOS-UH nicht unterstützt.');
                invalid++;
            }
            if (value === '(' || value === '[') brackets.push(value);
            if (value === ')' || value === ']') {
                if (!brackets.length) break;
                brackets.pop();
            }
            recorded.next();
        }
        return invalid;
    }
}
