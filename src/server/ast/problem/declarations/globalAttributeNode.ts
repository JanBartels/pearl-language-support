// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from "../../../core/sourceValue";

import { AstKind } from "../../astKind";
import { AstLookupResult } from "../../astLookupResult";
import { AstNode } from "../../astNode";

import { DocumentationProvider } from "../../../documentation/documentationProvider";
import { GlobalAttributeDocumentationProvider } from "../../../documentation/problem/declarations/globalAttributeDocumentationProvider";

export class GlobalAttributeNode extends AstNode {

    private static readonly provider =
        new GlobalAttributeDocumentationProvider();

    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly moduleName: SourceValue<string> | undefined
    ) {
        super(AstKind.GlobalAttribute);
    }

    override documentationProvider():
        DocumentationProvider<GlobalAttributeNode> {

        return GlobalAttributeNode.provider;
    }

    override lookupSourceValue(
        offset: number
    ): AstLookupResult | undefined {

        const keyword = this.lookupOwnSourceValue(
            offset,
            this.keyword
        );

        if (keyword) {
            return keyword;
        }

        return this.lookupOwnSourceValue(
            offset,
            this.moduleName
        );
    }

    public override dumpLabel(): string {
        return this.moduleName
            ? `GlobalAttribute(${this.moduleName.value})`
            : "GlobalAttribute";
    }

    public override getChildren(): readonly AstNode[] {
        return [];
    }
}
