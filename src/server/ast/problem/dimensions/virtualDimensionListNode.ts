// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DocumentationProvider } from '../../../documentation/documentationProvider';
import {
    VirtualDimensionListDocumentationProvider
} from '../../../documentation/problem/dimensions/virtualDimensionListDocumentationProvider';
import { AstKind } from '../../astKind';
import { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';

export class VirtualDimensionListNode extends AstNode {
    private static readonly provider = new VirtualDimensionListDocumentationProvider();

    constructor(public readonly rank: number) {
        super(AstKind.VirtualDimensionList);
    }

    override documentationProvider(): DocumentationProvider<VirtualDimensionListNode> {
        return VirtualDimensionListNode.provider;
    }

    override lookupSourceValue(_offset: number): AstLookupResult | undefined {
        return undefined;
    }

    override dumpLabel(): string {
        return `VirtualDimensionList(${this.rank})`;
    }

    override getChildren(): readonly AstNode[] {
        return [];
    }
}
