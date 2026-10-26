// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from "../../../core/sourceValue";

import { SourceOffset } from '../../../core/sourceOffset';
import { AstKind } from "../../astKind";
import { AstLookupResult } from "../../astLookupResult";
import { AstNode } from "../../astNode";

import { DocumentationProvider } from "../../../documentation/documentationProvider";
import { BoltAttributeDocumentationProvider } from "../../../documentation/problem/declarations/boltAttributeDocumentationProvider";

import { GlobalAttributeNode } from "./globalAttributeNode";

export class BoltAttributeNode extends AstNode {

    private static readonly provider =
        new BoltAttributeDocumentationProvider();

    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly global: GlobalAttributeNode | undefined
    ) {
        super(AstKind.BoltAttribute);

        if (global) {
            this.adopt(global);
        }
    }

    override documentationProvider():
        DocumentationProvider<BoltAttributeNode> {

        return BoltAttributeNode.provider;
    }

    override lookupSourceValue(
        position: SourceOffset
    ): AstLookupResult | undefined {

        const keyword = this.lookupOwnSourceValue(
            position,
            this.keyword
        );

        if (keyword) {
            return keyword;
        }

        return this.global?.lookupSourceValue(position);
    }

    public override dumpLabel(): string {
        return this.global
            ? "BoltAttribute(GLOBAL)"
            : "BoltAttribute";
    }

    public override getChildren(): readonly AstNode[] {
        return this.global
            ? [this.global]
            : [];
    }
}
