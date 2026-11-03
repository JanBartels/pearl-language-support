// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { SourceValue } from '../../../core/sourceValue';
import type { SourceOffset } from '../../../core/sourceOffset';
import { AstKind } from '../../astKind';
import type { DocumentationProvider } from '../../../documentation/documentationProvider';
import { TaskingStatementDocumentationProvider } from '../../../documentation/problem/statements/taskingDocumentationProvider';
import type { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';
import type { ExpressionNode } from '../expressions/expressionNode';
import { NameExpressionNode } from '../expressions/nameExpressionNode';
import { TaskingTimedStartNode } from './taskingTimedStartNode';
import { TaskingInterruptStartNode } from './taskingInterruptStartNode';

export type TaskingOperation = 'ACTIVATE' | 'TERMINATE' | 'SUSPEND'
    | 'CONTINUE' | 'RESUME' | 'PREVENT';
export type TaskingStartConditionNode = TaskingTimedStartNode | TaskingInterruptStartNode;

/** A task-control statement, with the optional prefix and target kept separate. */
export class TaskingStatementNode extends AstNode {
    private static readonly provider = new TaskingStatementDocumentationProvider();
    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly startCondition: TaskingStartConditionNode | undefined,
        public readonly task: NameExpressionNode | undefined,
        public readonly priorityKeyword: SourceValue<string> | undefined,
        public readonly priorityTokens: readonly SourceValue<string>[],
        public readonly priority: ExpressionNode | undefined,
        public readonly semicolon: SourceValue<string> | undefined
    ) {
        super(AstKind.TaskingStatement);
        if (startCondition) this.adopt(startCondition);
        if (task) this.adopt(task);
        if (priority) this.adopt(priority);
    }

    override documentationProvider(): DocumentationProvider<TaskingStatementNode> {
        return TaskingStatementNode.provider;
    }
    override getChildren(): readonly AstNode[] {
        return [this.startCondition, this.task, this.priority]
            .filter((node): node is AstNode => node !== undefined);
    }
    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        for (const child of this.getChildren()) {
            const match = child.lookupSourceValue(position);
            if (match) return match;
        }
        const own = this.lookupOwnSourceValue(position, this.keyword)
            ?? this.lookupOwnSourceValue(position, this.priorityKeyword)
            ?? this.lookupOwnSourceValue(position, this.semicolon);
        if (own) return own;
        for (const token of this.priorityTokens) {
            const match = this.lookupOwnSourceValue(position, token);
            if (match) return match;
        }
        return undefined;
    }
    override dumpLabel(): string { return `TaskingStatement(${this.keyword.value})`; }
}
