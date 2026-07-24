// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from "../../astKind";
import { AstLookupResult } from "../../astLookupResult";
import { AstNode } from "../../astNode";

import { DocumentationProvider } from "../../../documentation/documentationProvider";
import { VirtualDimensionListDocumentationProvider } from "../../../documentation/problem/dimensions/virtualDimensionListDocumentationProvider";

import { DimensionAttributeNode } from "./dimensionAttributeNode";

export class VirtualDimensionListNode extends AstNode {

    private static readonly provider =
        new VirtualDimensionListDocumentationProvider();

    constructor(
        public readonly dimensions: readonly DimensionAttributeNode[]
    ) {
        super(AstKind.VirtualDimensionList);

        this.adoptAll(dimensions);
    }

    override documentationProvider():
        DocumentationProvider<VirtualDimensionListNode> {

        return VirtualDimensionListNode.provider;
    }

    override lookupSourceValue(
        offset: number
    ): AstLookupResult | undefined {

        for (const dimension of this.dimensions) {

            const result = dimension.lookupSourceValue(offset);
            if (result) {
                return result;
            }
        }

        return undefined;
    }

    public override dumpLabel(): string {
        return `VirtualDimensionList(${this.dimensions.length})`;
    }

    public override getChildren(): readonly AstNode[] {
        return this.dimensions;
    }

}
