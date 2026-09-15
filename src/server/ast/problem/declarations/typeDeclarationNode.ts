// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from "../../astKind";
import { AstLookupResult } from "../../astLookupResult";
import { AstNode } from "../../astNode";

import { SourceValue } from "../../../core/sourceValue";

import { DocumentationProvider } from "../../../documentation/documentationProvider";
import { TypeDeclarationDocumentationProvider } from "../../../documentation/problem/declarations/typeDeclarationDocumentationProvider";

import { DimensionAttributeNode } from "../dimensions/dimensionAttributeNode";
import { ProblemDataTypeNode } from "../types/problemDataTypeNode";

export class TypeDeclarationNode extends AstNode {

    private static readonly provider =
        new TypeDeclarationDocumentationProvider();

    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly name: SourceValue<string>,
        public readonly dimension: DimensionAttributeNode | undefined,
        public readonly type: ProblemDataTypeNode | undefined
    ) {
        super(AstKind.TypeDeclaration);

        if (dimension) {
            this.adopt(dimension);
        }

        if (type) {
            this.adopt(type);
        }
    }

    override documentationProvider():
        DocumentationProvider<TypeDeclarationNode> {

        return TypeDeclarationNode.provider;
    }

    override lookupSourceValue(
        offset: number
    ): AstLookupResult | undefined {

        const dimension =
            this.dimension?.lookupSourceValue(offset);

        if (dimension) {
            return dimension;
        }

        const type =
            this.type?.lookupSourceValue(offset);

        if (type) {
            return type;
        }

        return this.lookupOwnSourceValue(
            offset,
            this.keyword
        ) ?? this.lookupOwnSourceValue(
            offset,
            this.name
        );
    }

    public override dumpLabel(): string {

        return this.dimension
            ? `TypeDeclaration(${this.name.value}, array)`
            : `TypeDeclaration(${this.name.value})`;
    }

    public override getChildren(): readonly AstNode[] {

        const children: AstNode[] = [];

        if (this.dimension) {
            children.push(this.dimension);
        }

        if (this.type) {
            children.push(this.type);
        }

        return children;
    }

}
