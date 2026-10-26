// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../../core/sourceValue';
import { DocumentationProvider } from '../../../documentation/documentationProvider';
import {
    SpcInterruptAttributeDocumentationProvider
} from '../../../documentation/problem/specifications/spcInterruptAttributeDocumentationProvider';
import { SourceOffset } from '../../../core/sourceOffset';
import { AstKind } from '../../astKind';
import { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';
import { GlobalAttributeNode } from '../declarations/globalAttributeNode';

export class SpcInterruptAttributeNode extends AstNode {
    private static readonly provider = new SpcInterruptAttributeDocumentationProvider();

    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly global: GlobalAttributeNode | undefined
    ) {
        super(AstKind.SpcInterruptAttribute);

        if (global) {
            this.adopt(global);
        }
    }

    override documentationProvider(): DocumentationProvider<SpcInterruptAttributeNode> {
        return SpcInterruptAttributeNode.provider;
    }

    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        return this.lookupOwnSourceValue(position, this.keyword) ?? this.global?.lookupSourceValue(position);
    }

    override dumpLabel(): string {
        return this.global ? 'SpcInterruptAttribute(GLOBAL)' : 'SpcInterruptAttribute';
    }

    override getChildren(): readonly AstNode[] {
        return this.global ? [this.global] : [];
    }
}
