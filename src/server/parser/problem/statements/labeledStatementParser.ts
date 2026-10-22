// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { LabeledStatementNode } from '../../../ast/problem/statements/labeledStatementNode';
import type { Token } from '../../../lexer/token';
import { ParserBase } from '../../parserBase';
import { StatementParser } from './statementParser';

/** Parses a label prefix, Identifier ':' Statement. */
export class LabeledStatementParser extends ParserBase {
    override parse(): LabeledStatementNode | undefined {
        this.skipTrivia();
        const identifier = this.acceptIdentifier();
        if (!identifier) return undefined;
        return this.parseAfterIdentifier(identifier);
    }

    /**
     * The caller has already consumed the common Identifier prefix.
     * The ':' is the grammatical discriminator between a label and an
     * identifier-led statement (e.g. an assignment).
     */
    parseAfterIdentifier(identifier: Token): LabeledStatementNode | undefined {
        this.skipTrivia();
        const colon = this.acceptOperator(':');
        if (!colon) return undefined;

        const label = this.tokenValue(identifier);
        const separator = this.tokenValue(colon);
        this.skipTrivia();

        if (this.eof() || this.isKeyword(['END', 'MODEND', 'FIN', 'ELSE', 'ALT', 'OUT'])) {
            this.problems.error(this.location(), 'Expected statement after label.');
            return new LabeledStatementNode([label], [separator], undefined);
        }

        // Always dispatch the body through StatementParser. In particular, an
        // identifier following ':' is not necessarily another label: it may
        // begin an ordinary statement, including a future assignment parser.
        const statement = new StatementParser(this.context).parse();

        // Multiple labels are one grammatical prefix to the same statement.
        if (statement instanceof LabeledStatementNode) {
            return new LabeledStatementNode(
                [label, ...statement.labels],
                [separator, ...statement.colons],
                statement.statement
            );
        }

        // Unsupported statements are skipped by StatementParser without a
        // misleading label diagnostic. Retain the valid label in the AST.
        return new LabeledStatementNode([label], [separator], statement);
    }
}
