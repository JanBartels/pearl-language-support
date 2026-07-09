// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstNode } from './astNode';
import { AstKind } from './astKind';
import { AstLookupResult } from './astLookupResult';

import { DocumentationProvider } from '../documentation/documentationProvider';
import { TranslationUnitDocumentationProvider } from '../documentation/translationUnitDocumentationProvider';

export class TranslationUnitNode extends AstNode {

    readonly children: AstNode[] = [];

    private static readonly provider = new TranslationUnitDocumentationProvider();

    constructor() {
        super(AstKind.TranslationUnit);
    }

    override documentationProvider():
        DocumentationProvider<TranslationUnitNode> {

        return TranslationUnitNode.provider;
    }

    override lookupSourceValue(
        offset: number
    ): AstLookupResult | undefined {

        let result: AstLookupResult | undefined;

        for (const child of this.children) {
            result = child.lookupSourceValue(offset);
            if (result) {
                return result;
            }
        }

        return undefined;
    }

    addChild(node: AstNode): void {
        this.children.push(this.adopt(node));
    }

    public override getChildren(): readonly AstNode[] {
        return this.children;
    }    

}
