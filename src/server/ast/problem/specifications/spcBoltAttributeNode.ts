// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../../core/sourceValue';
import { DocumentationProvider } from '../../../documentation/documentationProvider';
import {
    SpcBoltAttributeDocumentationProvider
} from '../../../documentation/problem/specifications/spcBoltAttributeDocumentationProvider';
import { AstKind } from '../../astKind';
import { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';
import { GlobalAttributeNode } from '../declarations/globalAttributeNode';

export class SpcBoltAttributeNode extends AstNode {
    private static readonly provider = new SpcBoltAttributeDocumentationProvider();

    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly global: GlobalAttributeNode | undefined
    ) {
        super(AstKind.SpcBoltAttribute);
        if (global) {
            this.adopt(global);
        }
    }

    override documentationProvider(): DocumentationProvider<SpcBoltAttributeNode> {
        return SpcBoltAttributeNode.provider;
    }

    override lookupSourceValue(offset: number): AstLookupResult | undefined {
        return this.lookupOwnSourceValue(offset, this.keyword) ?? this.global?.lookupSourceValue(offset);
    }

    override dumpLabel(): string {
        return this.global ? 'SpcBoltAttribute(GLOBAL)' : 'SpcBoltAttribute';
    }

    override getChildren(): readonly AstNode[] {
        return this.global ? [this.global] : [];
    }
}
