// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { CallStatementNode } from '../../../ast/problem/statements/callStatementNode';
import type { Token } from '../../../lexer/token';
import { ParserBase } from '../../parserBase';
import { ActualParameterListParser } from './actualParameterListParser';
import { ActualParameterListNode } from '../../../ast/problem/statements/actualParameterListNode';
import { ActualParameterNode } from '../../../ast/problem/statements/actualParameterNode';
import { parseBufferedExpression } from '../expressions/parseBufferedExpression';
import type { SourceValue } from '../../../core/sourceValue';

/** Parses both CALL Name(...) and Name(...) with the same call AST. */
export class CallStatementParser extends ParserBase {
    override parse(): CallStatementNode | undefined {
        this.skipTrivia();
        const keyword = this.acceptKeyword('CALL');
        if (!keyword) return undefined;

        this.skipTrivia();
        const identifier = this.expectIdentifier('Expected procedure identifier after CALL.');
        return this.parseCallTail(identifier, keyword);
    }

    /** Called after an identifier was consumed by the statement dispatcher. */
    parseAfterIdentifier(identifier: Token): CallStatementNode | undefined {
        return this.parseCallTail(identifier);
    }

    private parseCallTail(identifier: Token | undefined, keyword?: Token): CallStatementNode | undefined {
        this.skipTrivia();
        const opening = this.acceptOperator('(');
        const parsed = opening
            ? new ActualParameterListParser(this.context).parseAfterOpenParenthesis(opening)
            : undefined;
        this.skipTrivia();

        // In the keywordless form the final delimiter decides the grammar.
        // In particular, Feld(1) = x and Feld(1).CHAR(2) = x are not calls.
        // A known statement boundary permits local missing-';' recovery.
        if (!keyword && !this.isOperator(';')
            && !(opening && this.isCallRecoveryBoundary())) {
            return undefined;
        }

        for (const problem of parsed?.problems ?? []) {
            this.problems.error(problem.location, problem.message);
        }

        // The implicit-call dispatcher can speculatively parse an argument
        // list before it knows whether this is a CALL or an assignment.
        // Parse expressions only after the CALL interpretation is committed.
        const actualParameters = parsed && new ActualParameterListNode(
            parsed.node.openParenthesis,
            parsed.node.parameters.map((parameter, index) => {
                const expression = parseBufferedExpression(parsed.parameterTokens[index], this.context);
                // The buffered parser creates SourceValues for its syntax.
                // Reuse those instances in the compatibility token view so
                // existing source-lookup identity remains intact.
                const tokens = parameter.tokens.map(token => {
                    const location = token.location;
                    if (!expression || !location) return token;
                    const lookup = expression.lookupSourceValue({
                        uri: location.source.uri, offset: location.span.start
                    });
                    const resolved = lookup?.element;
                    return resolved?.location?.span.start === location.span.start
                        && resolved.location.span.end === location.span.end
                        && resolved.location.source === location.source
                        && typeof resolved.value === 'string'
                        ? resolved as SourceValue<string> : token;
                });
                return new ActualParameterNode(tokens, expression);
            }),
            parsed.node.commas, parsed.node.closeParenthesis, parsed.node.recoveryBoundary
        );

        if (!this.expectSemicolon(keyword
            ? "Expected ';' after CALL."
            : "Expected ';' after procedure call.")) {
            this.synchronize([';', 'END', 'MODEND', 'FIN', 'ELSE', 'ALT', 'OUT',
                'BEGIN', 'FOR', 'WHILE', 'REPEAT', 'IF', 'CASE', 'CALL', 'RETURN']);
            this.acceptSemicolon();
        }

        return new CallStatementNode(
            keyword ? this.tokenValue(keyword) : undefined,
            identifier ? this.tokenValue(identifier) : undefined,
            actualParameters
        );
    }

    private isCallRecoveryBoundary(): boolean {
        return this.eof() || this.isKeyword([
            'END', 'MODEND', 'FIN', 'ELSE', 'ALT', 'OUT', 'BEGIN',
            'FOR', 'WHILE', 'REPEAT', 'IF', 'CASE', 'CALL', 'RETURN', 'GOTO'
        ]);
    }
}
