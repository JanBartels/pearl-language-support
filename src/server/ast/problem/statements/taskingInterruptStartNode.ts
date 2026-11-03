// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { SourceValue } from '../../../core/sourceValue';
import type { SourceOffset } from '../../../core/sourceOffset';
import { AstKind } from '../../astKind';
import type { DocumentationProvider } from '../../../documentation/documentationProvider';
import { TaskingInterruptStartDocumentationProvider } from '../../../documentation/problem/statements/taskingDocumentationProvider';
import type { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';
import { NameExpressionNode } from '../expressions/nameExpressionNode';

/** RTOS-UH interrupt scheduling: WHEN InterruptName (no time clauses). */
export class TaskingInterruptStartNode extends AstNode {
    private static readonly provider = new TaskingInterruptStartDocumentationProvider();
    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly interrupt: NameExpressionNode | undefined
    ) {
        super(AstKind.TaskingInterruptStart);
        if (interrupt) this.adopt(interrupt);
    }

    override documentationProvider(): DocumentationProvider<TaskingInterruptStartNode> {
        return TaskingInterruptStartNode.provider;
    }
    override getChildren(): readonly AstNode[] { return this.interrupt ? [this.interrupt] : []; }
    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        return this.interrupt?.lookupSourceValue(position)
            ?? this.lookupOwnSourceValue(position, this.keyword);
    }
}
