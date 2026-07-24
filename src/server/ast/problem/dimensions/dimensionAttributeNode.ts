// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from "../../astKind";
import { AstLookupResult } from "../../astLookupResult";
import { AstNode } from "../../astNode";

import { SourceValue } from "../../../core/sourceValue";

import { DocumentationProvider } from "../../../documentation/documentationProvider";
import { DimensionAttributeDocumentationProvider } from "../../../documentation/problem/dimensions/dimensionAttributeDocumentationProvider";

import { DimensionBoundariesNode } from "./dimensionBoundariesNode";

export class DimensionAttributeNode extends AstNode {

    private static readonly provider =
        new DimensionAttributeDocumentationProvider();

    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly dimensions: readonly DimensionBoundariesNode[]
    ) {
        super(AstKind.DimensionAttribute);

        this.adoptAll(dimensions);
    }

    override documentationProvider():
        DocumentationProvider<DimensionAttributeNode> {

        return DimensionAttributeNode.provider;
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

        return this.lookupOwnSourceValue(
            offset,
            this.keyword
        );
    }

    public override dumpLabel(): string {
        return `DimensionAttribute(${this.dimensions.length})`;
    }

    public override getChildren(): readonly AstNode[] {
        return this.dimensions;
    }

}
