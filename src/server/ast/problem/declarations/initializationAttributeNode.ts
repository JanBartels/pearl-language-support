// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from "../../astKind";
import { AstLookupResult } from "../../astLookupResult";
import { AstNode } from "../../astNode";

import { SourceValue } from "../../../core/sourceValue";

import { DocumentationProvider } from "../../../documentation/documentationProvider";
import { InitializationAttributeDocumentationProvider } from "../../../documentation/problem/declarations/initializationAttributeDocumentationProvider";

import { InitElementNode } from "./initElementNode";

export class InitializationAttributeNode extends AstNode {

    private static readonly provider =
        new InitializationAttributeDocumentationProvider();

    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly elements: readonly InitElementNode[]
    ) {
        super(AstKind.InitializationAttribute);

        for (const element of elements) {
            this.adopt(element);
        }
    }

    override documentationProvider():
        DocumentationProvider<InitializationAttributeNode> {

        return InitializationAttributeNode.provider;
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

        for (const element of this.elements) {

            const result =
                element.lookupSourceValue(offset);

            if (result) {
                return result;
            }
        }

        return undefined;
    }

    public override dumpLabel(): string {
        return `InitializationAttribute(${this.keyword.value}, ${this.elements.length} elements)`;
    }

    public override getChildren(): readonly AstNode[] {
        return this.elements;
    }
}
