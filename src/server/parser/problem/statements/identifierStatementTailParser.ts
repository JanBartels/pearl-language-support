// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstNode } from '../../../ast/astNode';
import type { Token } from '../../../lexer/token';
import { ParserBase } from '../../parserBase';
import { CallStatementParser } from './callStatementParser';
import { LabeledStatementParser } from './labeledStatementParser';
import { AssignmentParser } from './assignmentParser';

/**
 * Identifier-led statement tail:
 *
 *   Identifier ':' Statement                 (label)
 *   Identifier [ '(' Arguments ')' ] ';'     (procedure call)
 *   Name (':=' | '=') Expression ';'          (assignment)
 *
 * The parenthesis alone does not identify a call. Array subscripts and
 * BIT/CHAR/CHARACTER selectors may precede an assignment; they must not
 * produce CallStatementNodes or speculative diagnostics.
 */
export class IdentifierStatementTailParser extends ParserBase {
    override parse(): AstNode | undefined {
        throw new Error('Use IdentifierStatementTailParser.parseAfterIdentifier().');
    }

    parseAfterIdentifier(identifier: Token): AstNode | undefined {
        this.skipTrivia();

        if (this.isOperator(':')) {
            return new LabeledStatementParser(this.context).parseAfterIdentifier(identifier);
        }

        const assignment = new AssignmentParser(this.context).parseAfterIdentifier(identifier);
        if (assignment) return assignment;

        return new CallStatementParser(this.context).parseAfterIdentifier(identifier);
    }
}
