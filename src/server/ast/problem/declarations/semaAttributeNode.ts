// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from "../../../core/sourceValue";

import { AstKind } from "../../astKind";
import { AstLookupResult } from "../../astLookupResult";
import { AstNode } from "../../astNode";

import { DocumentationProvider } from "../../../documentation/documentationProvider";
import { SemaAttributeDocumentationProvider } from "../../../documentation/problem/declarations/semaAttributeDocumentationProvider";

export class SemaAttributeNode extends AstNode {

    private static readonly provider =
        new SemaAttributeDocumentationProvider();

    constructor(
        public readonly keyword: SourceValue<string>
    ) {
        super(AstKind.SemaAttribute);
    }

    override documentationProvider():
        DocumentationProvider<SemaAttributeNode> {

        return SemaAttributeNode.provider;
    }

    override lookupSourceValue(
        offset: number
    ): AstLookupResult | undefined {

        return this.lookupOwnSourceValue(
            offset,
            this.keyword
        );
    }

    public override dumpLabel(): string {
        return "SemaAttribute";
    }

    public override getChildren(): readonly AstNode[] {
        return [];
    }
}
