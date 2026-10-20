// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from "../../../core/sourceValue";
import { Source } from "../../../source/source";
import { AstNode } from "../../astNode";
import { AstKind } from "../../astKind";
import { AstLookupResult } from "../../astLookupResult";
import { DocumentationProvider } from "../../../documentation/documentationProvider";
import { BlockDocumentationProvider } from "../../../documentation/problem/statements/blockDocumentationProvider";
import { FoldingRegionCollection } from "../../../folding/foldingRegionCollection";
import { createInclusiveFoldingRegion } from "../../../folding/foldingRegion";

export class BlockNode extends AstNode {

    private static readonly provider = new BlockDocumentationProvider();

    constructor(
        public readonly beginKeyword: SourceValue<string>,
        public readonly body: readonly AstNode[],
        public readonly endKeyword: SourceValue<string> | undefined,
        public readonly endIdentifier: SourceValue<string> | undefined
    ) {
        super(AstKind.Block);
        this.adoptAll(body);
    }

    override documentationProvider(): DocumentationProvider<BlockNode> {
        return BlockNode.provider;
    }

    override lookupSourceValue(offset: number): AstLookupResult | undefined {
        for (const child of this.body) {
            const result = child.lookupSourceValue(offset);
            if (result) {
                return result;
            }
        }

        return this.lookupOwnSourceValue(offset, this.beginKeyword)
            ?? this.lookupOwnSourceValue(offset, this.endKeyword)
            ?? this.lookupOwnSourceValue(offset, this.endIdentifier);
    }

    override addFoldingRegionsTo(source: Source, regions: FoldingRegionCollection): void {
        if (!this.beginKeyword.location || !this.endKeyword?.location) {
            return;
        }

        if (this.beginKeyword.location.source !== source || this.endKeyword.location.source !== source) {
            return;
        }

        const region = createInclusiveFoldingRegion(
            this.beginKeyword.location,
            this.endKeyword.location
        );

        if (region) {
            regions.add(region);
        }
    }

    override getChildren(): readonly AstNode[] {
        return this.body;
    }
}
