// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from '../../astKind';
import { AstNode } from '../../astNode';
import type { AstLookupResult } from '../../astLookupResult';
import type { SourceOffset } from '../../../core/sourceOffset';
import type { SourceValue } from '../../../core/sourceValue';
import type { DocumentationProvider } from '../../../documentation/documentationProvider';
import { DationControlDocumentationProvider } from '../../../documentation/problem/statements/dationControlDocumentationProvider';
import type { NameExpressionNode } from '../expressions/nameExpressionNode';
import type { DationControlOptionNode } from './dationControlOptionNode';

/** OPEN/CLOSE Dation [BY Option (',' Option)*] ';'. */
export class DationControlStatementNode extends AstNode {
    private static readonly provider = new DationControlDocumentationProvider();

    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly dation: NameExpressionNode | undefined,
        public readonly byKeyword: SourceValue<string> | undefined,
        public readonly options: readonly DationControlOptionNode[],
        public readonly commas: readonly SourceValue<string>[],
        public readonly semicolon: SourceValue<string> | undefined
    ) {
        super(AstKind.DationControlStatement);
        if (dation) this.adopt(dation);
        this.adoptAll(options);
    }

    override documentationProvider(): DocumentationProvider<DationControlStatementNode> {
        return DationControlStatementNode.provider;
    }

    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        const own = this.lookupOwnSourceValue(position, this.keyword)
            ?? this.dation?.lookupSourceValue(position)
            ?? this.lookupOwnSourceValue(position, this.byKeyword);
        if (own) return own;
        for (const option of this.options) {
            const found = option.lookupSourceValue(position);
            if (found) return found;
        }
        for (const comma of this.commas) {
            const found = this.lookupOwnSourceValue(position, comma);
            if (found) return found;
        }
        return this.lookupOwnSourceValue(position, this.semicolon);
    }

    override getChildren(): readonly AstNode[] {
        return this.dation ? [this.dation, ...this.options] : [...this.options];
    }

    override dumpLabel(): string {
        return `DationControlStatement(${this.keyword.value}, ${this.options.length} options)`;
    }
}
