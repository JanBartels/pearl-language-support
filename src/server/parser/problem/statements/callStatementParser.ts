// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { CallStatementNode } from '../../../ast/problem/statements/callStatementNode';
import type { Token } from '../../../lexer/token';
import { ParserBase } from '../../parserBase';
import { ActualParameterListParser } from './actualParameterListParser';

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
            parsed?.node
        );
    }

    private isCallRecoveryBoundary(): boolean {
        return this.eof() || this.isKeyword([
            'END', 'MODEND', 'FIN', 'ELSE', 'ALT', 'OUT', 'BEGIN',
            'FOR', 'WHILE', 'REPEAT', 'IF', 'CASE', 'CALL', 'RETURN', 'GOTO'
        ]);
    }
}
