// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceOffset } from '../../../core/sourceOffset';
import { SourceValue } from '../../../core/sourceValue';
import { AstKind } from '../../astKind';
import { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';
import { NameExpressionNode } from './nameExpressionNode';
import { ExpressionNode } from './expressionNode';

/** TRY Name is a non-blocking semaphore acquisition expression. */
import { DocumentationProvider } from '../../../documentation/documentationProvider';
import { TryExpressionDocumentationProvider } from '../../../documentation/problem/expressions/tryExpressionDocumentationProvider';

export class TryExpressionNode extends ExpressionNode {
    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly sema: NameExpressionNode | undefined
    ) {
        super(AstKind.TryExpression);
        if (sema) this.adopt(sema);
    }

    private static readonly provider = new TryExpressionDocumentationProvider();

    override documentationProvider(): DocumentationProvider<TryExpressionNode> {
        return TryExpressionNode.provider;
    }

    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        return this.lookupOwnSourceValue(position, this.keyword)
            ?? this.sema?.lookupSourceValue(position);
    }

    override getChildren(): readonly AstNode[] { return this.sema ? [this.sema] : []; }

    override dumpLabel(): string { return 'TryExpression'; }
}
