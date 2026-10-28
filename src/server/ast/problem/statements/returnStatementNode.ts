// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../../core/sourceValue';
import { SourceOffset } from '../../../core/sourceOffset';
import { AstKind } from '../../astKind';
import { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';
import { ExpressionNode } from '../expressions/expressionNode';
import { DocumentationProvider } from '../../../documentation/documentationProvider';
import { ReturnStatementDocumentationProvider } from '../../../documentation/problem/statements/returnStatementDocumentationProvider';

/** RETURN [ '(' Expression ')' ] ';'.
 * The expression is now a genuine AST child. Parentheses are SourceValues
 * rather than a location attached to the node.
 */
export class ReturnStatementNode extends AstNode {
    private static readonly provider = new ReturnStatementDocumentationProvider();

    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly openParenthesis?: SourceValue<string>,
        public readonly expression?: ExpressionNode,
        public readonly closeParenthesis?: SourceValue<string>
    ) {
        super(AstKind.ReturnStatement);
        if (expression) this.adopt(expression);
    }

    override documentationProvider(): DocumentationProvider<ReturnStatementNode> {
        return ReturnStatementNode.provider;
    }

    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        return this.lookupOwnSourceValue(position, this.keyword)
            ?? this.lookupOwnSourceValue(position, this.openParenthesis)
            ?? this.expression?.lookupSourceValue(position)
            ?? this.lookupOwnSourceValue(position, this.closeParenthesis);
    }

    override dumpLabel(): string {
        return this.openParenthesis ? 'ReturnStatement(expression)' : 'ReturnStatement';
    }

    override getChildren(): readonly AstNode[] {
        return this.expression ? [this.expression] : [];
    }
}
