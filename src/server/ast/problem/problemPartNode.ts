// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../core/sourceValue';
import { AstNode } from '../astNode';
import { AstKind } from '../astKind';
import { AstLookupResult } from '../astLookupResult';


import { DocumentationProvider } from '../../documentation/documentationProvider';
import { ProblemPartDocumentationProvider } from '../../documentation/problem/problemPartDocumentationProvider';

export class ProblemPartNode extends AstNode {

    readonly keyword: SourceValue<string>;

    readonly children: AstNode[] = [];

    private static readonly provider = new ProblemPartDocumentationProvider();

    constructor(
        keyword: SourceValue<string>
    ) {
        super(AstKind.ProblemPart);

        this.keyword = keyword;
    }

    override documentationProvider():
        DocumentationProvider<ProblemPartNode> {

        return ProblemPartNode.provider;
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

        return this.lookupOwnSourceValue(offset, this.keyword);
    }

    addChild(node: AstNode): void {
        this.children.push(node);
        this.adopt(node);
    }

    public override getChildren(): readonly AstNode[] {
        return this.children;
    }    
}