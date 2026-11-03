// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { SourceValue } from '../../../core/sourceValue';
import type { SourceOffset } from '../../../core/sourceOffset';
import { AstKind } from '../../astKind';
import type { DocumentationProvider } from '../../../documentation/documentationProvider';
import { TaskingFrequencyDocumentationProvider } from '../../../documentation/problem/statements/taskingDocumentationProvider';
import type { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';
import type { ExpressionNode } from '../expressions/expressionNode';
import { TaskingFrequencyLimitNode } from './taskingFrequencyLimitNode';

/** ALL DURATION-expression [UNTIL CLOCK-expression | DURING DURATION-expression]. */
export class TaskingFrequencyNode extends AstNode {
    private static readonly provider = new TaskingFrequencyDocumentationProvider();
    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly intervalTokens: readonly SourceValue<string>[],
        public readonly interval: ExpressionNode | undefined,
        public readonly limit: TaskingFrequencyLimitNode | undefined
    ) {
        super(AstKind.TaskingFrequency);
        if (interval) this.adopt(interval);
        if (limit) this.adopt(limit);
    }

    override documentationProvider(): DocumentationProvider<TaskingFrequencyNode> {
        return TaskingFrequencyNode.provider;
    }
    override getChildren(): readonly AstNode[] {
        return [...(this.interval ? [this.interval] : []), ...(this.limit ? [this.limit] : [])];
    }
    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        for (const child of this.getChildren()) {
            const match = child.lookupSourceValue(position);
            if (match) return match;
        }
        const keyword = this.lookupOwnSourceValue(position, this.keyword);
        if (keyword) return keyword;
        for (const token of this.intervalTokens) {
            const match = this.lookupOwnSourceValue(position, token);
            if (match) return match;
        }
        return undefined;
    }
    override dumpLabel(): string { return `TaskingFrequency(${this.keyword.value})`; }
}
