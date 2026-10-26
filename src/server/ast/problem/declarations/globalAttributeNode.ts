// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../../core/sourceValue';
import { SourceOffset } from '../../../core/sourceOffset';
import { AstKind } from '../../astKind';
import { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';
import { DocumentationProvider } from '../../../documentation/documentationProvider';
import { GlobalAttributeDocumentationProvider } from '../../../documentation/problem/declarations/globalAttributeDocumentationProvider';

/** RTOS-UH GLOBAL is a keyword without a module qualifier. */
export class GlobalAttributeNode extends AstNode {
    private static readonly provider = new GlobalAttributeDocumentationProvider();

    constructor(public readonly keyword: SourceValue<string>) {
        super(AstKind.GlobalAttribute);
    }

    override documentationProvider(): DocumentationProvider<GlobalAttributeNode> {
        return GlobalAttributeNode.provider;
    }

    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        return this.lookupOwnSourceValue(position, this.keyword);
    }

    override getChildren(): readonly AstNode[] { return []; }
}
