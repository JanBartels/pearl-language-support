// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceOffset } from '../../../core/sourceOffset';
import { SourceValue } from '../../../core/sourceValue';
import { AstKind } from '../../astKind';
import { NameSegmentDocumentationProvider } from '../../../documentation/problem/expressions/nameSegmentDocumentationProvider';
import { DocumentationProvider } from '../../../documentation/documentationProvider';
import { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';
import { NameArgumentListNode } from './nameArgumentListNode';

/** One lexical component of Name, optionally followed by parentheses. */
export class NameSegmentNode extends AstNode {
    private static readonly provider = new NameSegmentDocumentationProvider();

    constructor(
        public readonly identifier: SourceValue<string>,
        public readonly dot?: SourceValue<string>,
        public readonly suffix?: NameArgumentListNode
    ) {
        super(AstKind.NameSegment);
        if (suffix) this.adopt(suffix);
    }

    override documentationProvider(): DocumentationProvider<NameSegmentNode> {
        return NameSegmentNode.provider;
    }

    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        return this.lookupOwnSourceValue(position, this.dot)
            ?? this.lookupOwnSourceValue(position, this.identifier)
            ?? this.suffix?.lookupSourceValue(position);
    }

    override getChildren(): readonly AstNode[] { return this.suffix ? [this.suffix] : []; }

    override dumpLabel(): string { return `NameSegment(${this.identifier.value})`; }
}
