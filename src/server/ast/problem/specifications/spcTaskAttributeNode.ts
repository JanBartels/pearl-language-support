// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from "../../../core/sourceValue";
import { AstKind } from "../../astKind";
import { AstLookupResult } from "../../astLookupResult";
import { AstNode } from "../../astNode";
import { GlobalAttributeNode } from "../declarations/globalAttributeNode";

export class SpcTaskAttributeNode extends AstNode {
    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly global: GlobalAttributeNode | undefined
    ) {
        super(AstKind.SpcTaskAttribute);
        if (global) { this.adopt(global); }
    }

    override documentationProvider(): undefined { return undefined; }

    override lookupSourceValue(offset: number): AstLookupResult | undefined {
        return this.lookupOwnSourceValue(offset, this.keyword)
            ?? this.global?.lookupSourceValue(offset);
    }

    override dumpLabel(): string { return "SpcTaskAttribute"; }
    override getChildren(): readonly AstNode[] { return this.global ? [this.global] : []; }
}
