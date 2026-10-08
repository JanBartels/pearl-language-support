// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from "../../../core/sourceValue";

import { AstKind } from "../../astKind";
import { AstLookupResult } from "../../astLookupResult";
import { AstNode } from "../../astNode";

import { DocumentationProvider } from "../../../documentation/documentationProvider";
import {
    SemaAttributeDocumentationProvider
} from "../../../documentation/problem/declarations/semaAttributeDocumentationProvider";

import { ConstantFixedExpressionNode } from "../expressions/constantFixedExpressionNode";

export class SemaAttributeNode extends AstNode {

    private static readonly provider =
        new SemaAttributeDocumentationProvider();

    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly presetKeyword: SourceValue<string> | undefined,
        public readonly presetValues: readonly ConstantFixedExpressionNode[]
    ) {
        super(AstKind.SemaAttribute);

        for (const value of presetValues) {
            this.adopt(value);
        }
    }

    override documentationProvider():
        DocumentationProvider<SemaAttributeNode> {

        return SemaAttributeNode.provider;
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

        const presetKeyword = this.lookupOwnSourceValue(
            offset,
            this.presetKeyword
        );

        if (presetKeyword) {
            return presetKeyword;
        }

        for (const value of this.presetValues) {
            const result = value.lookupSourceValue(offset);

            if (result) {
                return result;
            }
        }

        return undefined;
    }

    public override dumpLabel(): string {
        if (!this.presetKeyword) {
            return "SemaAttribute";
        }

        return `SemaAttribute(PRESET, ${this.presetValues.length} values)`;
    }

    public override getChildren(): readonly AstNode[] {
        return this.presetValues;
    }
}
