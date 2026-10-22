// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../../core/sourceValue';
import { AstKind } from '../../astKind';
import { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';
import { DocumentationProvider } from '../../../documentation/documentationProvider';
import { EmptyStatementDocumentationProvider } from '../../../documentation/problem/statements/emptyStatementDocumentationProvider';

/** Empty statement (';'), which may also carry a label. */
export class EmptyStatementNode extends AstNode {
    private static readonly provider = new EmptyStatementDocumentationProvider();

    constructor(public readonly semicolon: SourceValue<string>) {
        super(AstKind.EmptyStatement);
    }

    override documentationProvider(): DocumentationProvider<EmptyStatementNode> {
        return EmptyStatementNode.provider;
    }

    override lookupSourceValue(offset: number): AstLookupResult | undefined {
        return this.lookupOwnSourceValue(offset, this.semicolon);
    }
}
