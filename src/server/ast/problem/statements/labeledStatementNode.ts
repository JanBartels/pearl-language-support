// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../../core/sourceValue';
import { SourceOffset } from '../../../core/sourceOffset';
import { AstKind } from '../../astKind';
import { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';
import { DocumentationProvider } from '../../../documentation/documentationProvider';
import { LabeledStatementDocumentationProvider } from '../../../documentation/problem/statements/labeledStatementDocumentationProvider';

/** One or more labels attached to a single (possibly erroneous) statement. */
export class LabeledStatementNode extends AstNode {
    private static readonly provider = new LabeledStatementDocumentationProvider();

    constructor(
        public readonly labels: readonly SourceValue<string>[],
        public readonly colons: readonly SourceValue<string>[],
        public readonly statement: AstNode | undefined
    ) {
        super(AstKind.LabeledStatement);
        if (statement) this.adopt(statement);
    }

    override documentationProvider(): DocumentationProvider<LabeledStatementNode> {
        return LabeledStatementNode.provider;
    }

    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        const statement = this.statement?.lookupSourceValue(position);
        if (statement) return statement;
        for (const source of [...this.labels, ...this.colons]) {
            const result = this.lookupOwnSourceValue(position, source);
            if (result) return result;
        }
        return undefined;
    }

    override getChildren(): readonly AstNode[] {
        return this.statement ? [this.statement] : [];
    }

    override dumpLabel(): string {
        return `LabeledStatement(${this.labels.map(label => label.value).join(', ')})`;
    }
}
