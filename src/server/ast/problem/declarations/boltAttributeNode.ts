// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from "../../../core/sourceValue";

import { AstKind } from "../../astKind";
import { AstLookupResult } from "../../astLookupResult";
import { AstNode } from "../../astNode";

import { DocumentationProvider } from "../../../documentation/documentationProvider";
import { BoltAttributeDocumentationProvider } from "../../../documentation/problem/declarations/boltAttributeDocumentationProvider";

export class BoltAttributeNode extends AstNode {

    private static readonly provider =
        new BoltAttributeDocumentationProvider();

    constructor(
        public readonly keyword: SourceValue<string>
    ) {
        super(AstKind.BoltAttribute);
    }

    override documentationProvider():
        DocumentationProvider<BoltAttributeNode> {

        return BoltAttributeNode.provider;
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
        return "BoltAttribute";
    }

    public override getChildren(): readonly AstNode[] {
        return [];
    }
}
