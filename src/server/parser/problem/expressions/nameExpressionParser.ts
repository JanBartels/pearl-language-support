// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Token } from '../../../lexer/token';
import { NameArgumentListNode } from '../../../ast/problem/expressions/nameArgumentListNode';
import { NameExpressionNode } from '../../../ast/problem/expressions/nameExpressionNode';
import { NameSegmentNode } from '../../../ast/problem/expressions/nameSegmentNode';
import { ExpressionNode } from '../../../ast/problem/expressions/expressionNode';
import { SourceValue } from '../../../core/sourceValue';
import { ParserBase } from '../../parserBase';
import { ExpressionParser } from './expressionParser';

/** Parses Name tails without using a symbol table.
 * The same parentheses can mean indexing or a function call.
 */
export class NameExpressionParser extends ParserBase {
    override parse(): NameExpressionNode | undefined {
        this.skipTrivia();
        const identifier = this.acceptIdentifier();
        return identifier ? this.parseAfterIdentifier(identifier) : undefined;
    }

    parseAfterIdentifier(identifier: Token): NameExpressionNode {
        const segments = [this.parseSegment(this.tokenValue(identifier))];
        while (true) {
            this.skipTrivia();
            const dot = this.acceptOperator('.');
            if (!dot) break;
            this.skipTrivia();
            // BIT/CHAR/CHARACTER are keywords, not identifiers, but can
            // occur after '.' as standard component selectors.
            const segmentName = this.acceptIdentifier()
                ?? this.acceptKeyword(['BIT', 'CHAR', 'CHARACTER']);
            if (!segmentName) {
                this.problems.error(this.location(), "Expected component name after '.'.");
                // Preserve the dot as a syntax element of the incomplete name.
                segments.push(new NameSegmentNode(SourceValue.synthetic('<error>'),
                    this.tokenValue(dot)));
                break;
            }
            segments.push(this.parseSegment(this.tokenValue(segmentName), this.tokenValue(dot)));
        }
        return new NameExpressionNode(segments);
    }

    private parseSegment(identifier: SourceValue<string>, dot?: SourceValue<string>): NameSegmentNode {
        this.skipTrivia();
        const opening = this.acceptOperator('(');
        const suffix = opening ? this.parseArguments(this.tokenValue(opening)) : undefined;
        return new NameSegmentNode(identifier, dot, suffix);
    }

    private parseArguments(opening: SourceValue<string>): NameArgumentListNode {
        const expressions: (ExpressionNode | undefined)[] = [];
        const commas: SourceValue<string>[] = [];
        this.skipTrivia();

        if (!this.isOperator(')')) {
            while (true) {
                const expression = new ExpressionParser(this.context).parse();
                expressions.push(expression);
                if (!expression) {
                    this.problems.error(this.location(), 'Expected expression in name parentheses.');
                }
                this.skipTrivia();
                const comma = this.acceptOperator(',');
                if (!comma) break;
                commas.push(this.tokenValue(comma));
                this.skipTrivia();
                if (this.isOperator(')')) {
                    expressions.push(undefined);
                    this.problems.error(this.location(), "Expected expression after ','.");
                    break;
                }
                // An empty slot before a comma remains visible in the AST.
            }
        }

        this.skipTrivia();
        const closing = this.acceptOperator(')');
        if (!closing) {
            this.problems.error(this.location(), "Expected ')' after name parentheses.");
        }
        return new NameArgumentListNode(opening, expressions, commas,
            closing ? this.tokenValue(closing) : undefined);
    }
}
