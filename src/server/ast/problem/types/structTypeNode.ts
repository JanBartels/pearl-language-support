// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceOffset } from '../../../core/sourceOffset';
import { AstKind } from "../../astKind";
import { AstLookupResult } from "../../astLookupResult";
import { AstNode } from "../../astNode";

import { SourceValue } from "../../../core/sourceValue";

import { DocumentationProvider } from "../../../documentation/documentationProvider";
import { StructTypeDocumentationProvider } from "../../../documentation/problem/types/structTypeDocumentationProvider";

import { StructComponentNode } from "./structComponentNode";
import { Source } from "../../../source/source";
import { FoldingRegionCollection } from "../../../folding/foldingRegionCollection";
import { createInclusiveFoldingRegion } from "../../../folding/foldingRegion";

export class StructTypeNode extends AstNode {

    private static readonly provider =
        new StructTypeDocumentationProvider();

    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly components:
            readonly StructComponentNode[],
        /** The closing bracket is retained for source-accurate STRUCT folding. */
        public readonly closingBracket?: SourceValue<string>
    ) {
        super(AstKind.StructType);

        for (const component of components) {
            this.adopt(component);
        }
    }

    override documentationProvider():
        DocumentationProvider<StructTypeNode> {

        return StructTypeNode.provider;
    }

    override lookupSourceValue(
        position: SourceOffset
    ): AstLookupResult | undefined {

        const keyword =
            this.lookupOwnSourceValue(
                position,
                this.keyword
            );

        if (keyword) {
            return keyword;
        }

        for (const component of this.components) {

            const result =
                component.lookupSourceValue(position);

            if (result) {
                return result;
            }
        }

        return undefined;
    }

    override addFoldingRegionsTo(
        source: Source,
        regions: FoldingRegionCollection
    ): void {
        const start = this.keyword.location;
        const end = this.closingBracket?.location;
        if (!start || !end || start.source !== source || end.source !== source) {
            return;
        }
        const region = createInclusiveFoldingRegion(start, end);
        if (region) regions.add(region);
    }

    public override dumpLabel(): string {
        return `StructType(${this.components.length})`;
    }

    public override getChildren(): readonly AstNode[] {
        return this.components;
    }

}
