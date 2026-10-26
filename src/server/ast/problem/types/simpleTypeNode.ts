// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceOffset } from '../../../core/sourceOffset';
import { AstKind } from "../../astKind";
import { AstLookupResult } from "../../astLookupResult";
import { AstNode } from "../../astNode";

import { SourceValue } from "../../../core/sourceValue";

import { DocumentationProvider } from "../../../documentation/documentationProvider";
import { SimpleTypeDocumentationProvider } from "../../../documentation/problem/types/simpleTypeDocumentationProvider";

import { ConstantFixedExpressionNode } from "../expressions/constantFixedExpressionNode";

export class SimpleTypeNode extends AstNode {

    private static readonly provider =
        new SimpleTypeDocumentationProvider();

    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly precisionOrLength:
            ConstantFixedExpressionNode | undefined
    ) {
        super(AstKind.SimpleType);

        if (precisionOrLength) {
            this.adopt(precisionOrLength);
        }
    }

    override documentationProvider():
        DocumentationProvider<SimpleTypeNode> {

        return SimpleTypeNode.provider;
    }

    override lookupSourceValue(
        position: SourceOffset
    ): AstLookupResult | undefined {

        return this.precisionOrLength?.lookupSourceValue(position)
            ?? this.lookupOwnSourceValue(
                position,
                this.keyword
            );
    }

    public override dumpLabel(): string {

        return this.precisionOrLength
            ? `SimpleType(${this.keyword.value}, precision/length)`
            : `SimpleType(${this.keyword.value})`;
    }

    public override getChildren(): readonly AstNode[] {

        return this.precisionOrLength
            ? [this.precisionOrLength]
            : [];
    }
}
