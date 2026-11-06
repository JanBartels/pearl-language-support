// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from '../../astKind';
import { AstNode } from '../../astNode';
import type { AstLookupResult } from '../../astLookupResult';
import type { SourceOffset } from '../../../core/sourceOffset';
import type { SourceValue } from '../../../core/sourceValue';
import type { DocumentationProvider } from '../../../documentation/documentationProvider';
import { FormatDeclarationDocumentationProvider } from '../../../documentation/problem/statements/formatDeclarationDocumentationProvider';
import type { FormatListNode } from '../statements/formatListNode';

/** NAME: FORMAT (format-list);; declaring a reusable format sequence. */
export class FormatDeclarationNode extends AstNode {
    private static readonly provider = new FormatDeclarationDocumentationProvider();
    constructor(
        public readonly name: SourceValue<string>,
        public readonly colon: SourceValue<string> | undefined,
        public readonly keyword: SourceValue<string>,
        public readonly formats: FormatListNode | undefined,
        public readonly semicolon: SourceValue<string> | undefined
    ) {
        super(AstKind.FormatDeclaration);
        if (formats) this.adopt(formats);
    }
    override documentationProvider(): DocumentationProvider<FormatDeclarationNode> {
        return FormatDeclarationNode.provider;
    }
    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        for (const source of [this.name, this.colon, this.keyword]) {
            const hit = this.lookupOwnSourceValue(position, source);
            if (hit) return hit;
        }
        return this.formats?.lookupSourceValue(position)
            ?? this.lookupOwnSourceValue(position, this.semicolon);
    }
    override getChildren(): readonly AstNode[] { return this.formats ? [this.formats] : []; }
    override dumpLabel(): string { return `FormatDeclaration(${this.name.value})`; }
}
