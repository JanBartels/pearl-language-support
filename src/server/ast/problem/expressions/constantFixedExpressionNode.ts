// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from "../../astKind";
import { AstLookupResult } from "../../astLookupResult";
import { AstNode } from "../../astNode";

import { SourceValue } from "../../../core/sourceValue";

import { DocumentationProvider } from "../../../documentation/documentationProvider";
import { ConstantFixedExpressionDocumentationProvider } from "../../../documentation/problem/expressions/constantFixedExpressionDocumentationProvider";

export class ConstantFixedExpressionNode extends AstNode {

    private static readonly provider =
        new ConstantFixedExpressionDocumentationProvider();

    constructor(
        public readonly literal: SourceValue<string>
    ) {
        super(AstKind.ConstantFixedExpression);
    }

    override documentationProvider():
        DocumentationProvider<ConstantFixedExpressionNode> {

        return ConstantFixedExpressionNode.provider;
    }

    override lookupSourceValue(
        offset: number
    ): AstLookupResult | undefined {

        return this.lookupOwnSourceValue(
            offset,
            this.literal
        );
    }

    public override dumpLabel(): string {
        return `ConstantFixedExpression(${this.literal.value})`;
    }

    public override getChildren(): readonly AstNode[] {
        return [];
    }

}
