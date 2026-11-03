// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { SourceValue } from '../../../core/sourceValue';
import type { SourceOffset } from '../../../core/sourceOffset';
import { AstKind } from '../../astKind';
import type { DocumentationProvider } from '../../../documentation/documentationProvider';
import { TaskingTimeClauseDocumentationProvider } from '../../../documentation/problem/statements/taskingDocumentationProvider';
import type { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';
import type { ExpressionNode } from '../expressions/expressionNode';

/** AT CLOCK-expression | AFTER DURATION-expression. Types are checked by semantics. */
export class TaskingTimeClauseNode extends AstNode {
    private static readonly provider = new TaskingTimeClauseDocumentationProvider();
    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly expressionTokens: readonly SourceValue<string>[],
        public readonly expression: ExpressionNode | undefined
    ) {
        super(AstKind.TaskingTimeClause);
        if (expression) this.adopt(expression);
    }

    override documentationProvider(): DocumentationProvider<TaskingTimeClauseNode> {
        return TaskingTimeClauseNode.provider;
    }
    override getChildren(): readonly AstNode[] { return this.expression ? [this.expression] : []; }
    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        const child = this.expression?.lookupSourceValue(position);
        if (child) return child;
        const keyword = this.lookupOwnSourceValue(position, this.keyword);
        if (keyword) return keyword;
        for (const token of this.expressionTokens) {
            const match = this.lookupOwnSourceValue(position, token);
            if (match) return match;
        }
        return undefined;
    }
    override dumpLabel(): string { return `TaskingTimeClause(${this.keyword.value})`; }
}
