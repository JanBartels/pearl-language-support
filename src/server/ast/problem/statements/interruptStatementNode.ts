// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { SourceValue } from '../../../core/sourceValue';
import type { SourceOffset } from '../../../core/sourceOffset';
import { AstKind } from '../../astKind';
import type { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';
import type { DocumentationProvider } from '../../../documentation/documentationProvider';
import { InterruptStatementDocumentationProvider } from '../../../documentation/problem/statements/interruptStatementDocumentationProvider';
import { NameExpressionNode } from '../expressions/nameExpressionNode';

export type InterruptOperation = 'ENABLE' | 'DISABLE' | 'TRIGGER';

/** ENABLE | DISABLE | TRIGGER followed by an interrupt name and ';'. */
export class InterruptStatementNode extends AstNode {
    private static readonly provider = new InterruptStatementDocumentationProvider();

    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly interrupt: NameExpressionNode | undefined,
        public readonly semicolon: SourceValue<string> | undefined
    ) {
        super(AstKind.InterruptStatement);
        if (interrupt) this.adopt(interrupt);
    }

    override documentationProvider(): DocumentationProvider<InterruptStatementNode> {
        return InterruptStatementNode.provider;
    }

    override getChildren(): readonly AstNode[] {
        return this.interrupt ? [this.interrupt] : [];
    }

    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        return this.interrupt?.lookupSourceValue(position)
            ?? this.lookupOwnSourceValue(position, this.keyword)
            ?? this.lookupOwnSourceValue(position, this.semicolon);
    }

    override dumpLabel(): string {
        return `InterruptStatement(${this.keyword.value})`;
    }
}
