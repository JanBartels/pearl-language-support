// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from "../../../core/sourceValue";

import { SourceOffset } from '../../../core/sourceOffset';
import { AstKind } from "../../astKind";
import { AstLookupResult } from "../../astLookupResult";
import { AstNode } from "../../astNode";

import { DocumentationProvider } from "../../../documentation/documentationProvider";
import { DclDeclarationDocumentationProvider } from "../../../documentation/problem/declarations/dclDeclarationDocumentationProvider";

import { DclDeclarationSentenceNode } from "./dclDeclarationSentenceNode";

export class DclDeclarationNode extends AstNode {

    private static readonly provider =
        new DclDeclarationDocumentationProvider();

    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly declarations:
            readonly DclDeclarationSentenceNode[]
    ) {
        super(AstKind.DclDeclaration);

        this.adoptAll(declarations);
    }

    override documentationProvider():
        DocumentationProvider<DclDeclarationNode> {

        return DclDeclarationNode.provider;
    }

    override lookupSourceValue(
        position: SourceOffset
    ): AstLookupResult | undefined {

        for (const declaration of this.declarations) {

            const result =
                declaration.lookupSourceValue(position);

            if (result) {
                return result;
            }
        }

        return this.lookupOwnSourceValue(
            position,
            this.keyword
        );
    }

    public override dumpLabel(): string {
        return `DclDeclaration(${this.declarations.length})`;
    }

    public override getChildren(): readonly AstNode[] {
        return this.declarations;
    }
}
