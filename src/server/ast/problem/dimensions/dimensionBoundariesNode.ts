// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from "../../astKind";
import { AstLookupResult } from "../../astLookupResult";
import { AstNode } from "../../astNode";

import { DocumentationProvider } from "../../../documentation/documentationProvider";
import { DimensionBoundariesDocumentationProvider } from "../../../documentation/problem/dimensions/dimensionBoundariesDocumentationProvider";

import { ConstantFixedExpressionNode } from "../expressions/constantFixedExpressionNode";

export class DimensionBoundariesNode extends AstNode {

    private static readonly provider =
        new DimensionBoundariesDocumentationProvider();

    constructor(
        public readonly lowerBoundary: ConstantFixedExpressionNode | undefined,
        public readonly upperBoundary: ConstantFixedExpressionNode
    ) {
        super(AstKind.DimensionBoundaries);

        if (lowerBoundary) {
            this.adopt(lowerBoundary);
        }

        this.adopt(upperBoundary);
    }

    override documentationProvider():
        DocumentationProvider<DimensionBoundariesNode> {

        return DimensionBoundariesNode.provider;
    }

    override lookupSourceValue(
        offset: number
    ): AstLookupResult | undefined {

        return this.lowerBoundary?.lookupSourceValue(offset)
            ?? this.upperBoundary.lookupSourceValue(offset);
    }

    public override dumpLabel(): string {
        return "DimensionBoundaries";
    }

    public override getChildren(): readonly AstNode[] {

        return this.lowerBoundary
            ? [this.lowerBoundary, this.upperBoundary]
            : [this.upperBoundary];
    }

}
