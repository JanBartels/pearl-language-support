// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../../core/sourceValue';
import { DocumentationProvider } from '../../../documentation/documentationProvider';
import {
    SpcDeclarationDocumentationProvider
} from '../../../documentation/problem/specifications/spcDeclarationDocumentationProvider';
import { SourceOffset } from '../../../core/sourceOffset';
import { AstKind } from '../../astKind';
import { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';
import { SpcDeclarationSentenceNode } from './spcDeclarationSentenceNode';

export class SpcDeclarationNode extends AstNode {
    private static readonly provider = new SpcDeclarationDocumentationProvider();

    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly specifications: readonly SpcDeclarationSentenceNode[]
    ) {
        super(AstKind.SpcDeclaration);
        this.adoptAll(specifications);
    }

    override documentationProvider(): DocumentationProvider<SpcDeclarationNode> {
        return SpcDeclarationNode.provider;
    }

    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        for (const specification of this.specifications) {
            const result = specification.lookupSourceValue(position);
            if (result) {
                return result;
            }
        }

        return this.lookupOwnSourceValue(position, this.keyword);
    }

    override dumpLabel(): string {
        return `SpcDeclaration(${this.specifications.length})`;
    }

    override getChildren(): readonly AstNode[] {
        return this.specifications;
    }
}
