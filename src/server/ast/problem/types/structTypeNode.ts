// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from "../../astKind";
import { AstLookupResult } from "../../astLookupResult";
import { AstNode } from "../../astNode";

import { SourceValue } from "../../../core/sourceValue";

import { DocumentationProvider } from "../../../documentation/documentationProvider";
import { StructTypeDocumentationProvider } from "../../../documentation/problem/types/structTypeDocumentationProvider";

import { StructComponentNode } from "./structComponentNode";

export class StructTypeNode extends AstNode {

    private static readonly provider =
        new StructTypeDocumentationProvider();

    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly components:
            readonly StructComponentNode[]
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
        offset: number
    ): AstLookupResult | undefined {

        const keyword =
            this.lookupOwnSourceValue(
                offset,
                this.keyword
            );

        if (keyword) {
            return keyword;
        }

        for (const component of this.components) {

            const result =
                component.lookupSourceValue(offset);

            if (result) {
                return result;
            }
        }

        return undefined;
    }

    public override dumpLabel(): string {
        return `StructType(${this.components.length})`;
    }

    public override getChildren(): readonly AstNode[] {
        return this.components;
    }

}
