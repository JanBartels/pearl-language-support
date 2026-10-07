// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from "../../../core/sourceValue";

import { AstKind } from "../../astKind";
import { AstLookupResult } from "../../astLookupResult";
import { AstNode } from "../../astNode";

import { DocumentationProvider } from "../../../documentation/documentationProvider";
import { RefTypeDocumentationProvider } from "../../../documentation/problem/types/refTypeDocumentationProvider";

import { SimpleTypeNode } from "./simpleTypeNode";
import { NamedTypeNode } from "./namedTypeNode";
import { StructTypeNode } from "./structTypeNode";

export type RefTargetTypeNode =
    | SimpleTypeNode
    | NamedTypeNode
    | StructTypeNode
    ;

export class RefTypeNode extends AstNode {

    private static readonly provider = new RefTypeDocumentationProvider();

    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly target: RefTargetTypeNode
    ) {
        super(AstKind.RefType);

        this.adopt(target);
    }

    override documentationProvider(): DocumentationProvider<RefTypeNode> {

        return RefTypeNode.provider;
    }

    override lookupSourceValue( offset: number ): AstLookupResult | undefined {

        const keyword = this.lookupOwnSourceValue(offset, this.keyword);

        if (keyword) {
            return keyword;
        }

        return this.target.lookupSourceValue(offset);
    }

    public override dumpLabel(): string {
        return "RefType";
    }

    public override getChildren(): readonly AstNode[] {
        return [
            this.target
        ];
    }

}
