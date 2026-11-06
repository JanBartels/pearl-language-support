// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from '../../astKind';
import { AstNode } from '../../astNode';
import type { AstLookupResult } from '../../astLookupResult';
import type { SourceOffset } from '../../../core/sourceOffset';
import type { SourceValue } from '../../../core/sourceValue';
import type { DocumentationProvider } from '../../../documentation/documentationProvider';
import { FormatReferenceDocumentationProvider } from '../../../documentation/problem/statements/formatReferenceDocumentationProvider';

/** Reference to a FORMAT declaration; unlike format parameters it is not an expression. */
export class FormatReferenceNode extends AstNode {
    private static readonly provider = new FormatReferenceDocumentationProvider();
    constructor(public readonly identifier: SourceValue<string>) {
        super(AstKind.FormatReference);
    }
    override documentationProvider(): DocumentationProvider<FormatReferenceNode> {
        return FormatReferenceNode.provider;
    }
    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        return this.lookupOwnSourceValue(position, this.identifier);
    }
    override dumpLabel(): string { return `FormatReference(${this.identifier.value})`; }
}
