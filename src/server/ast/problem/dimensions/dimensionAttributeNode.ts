// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from "../../astKind";
import { AstLookupResult } from "../../astLookupResult";
import { AstNode } from "../../astNode";

import { DimensionBoundariesNode } from "./dimensionBoundariesNode";

export class DimensionAttributeNode extends AstNode {

    constructor(
        public readonly dimensions:
            readonly DimensionBoundariesNode[]
    ) {
        super(AstKind.DimensionAttribute);

        this.adoptAll(dimensions);
    }

    override documentationProvider(): undefined {
        return undefined;
    }

    override lookupSourceValue(
        offset: number
    ): AstLookupResult | undefined {

        for (const dimension of this.dimensions) {

            const result =
                dimension.lookupSourceValue(offset);

            if (result) {
                return result;
            }
        }

        return undefined;
    }

    public override dumpLabel(): string {
        return `DimensionAttribute(${this.dimensions.length})`;
    }

    public override getChildren(): readonly AstNode[] {
        return this.dimensions;
    }

}
