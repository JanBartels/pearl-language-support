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
import { GlobalAttributeNode } from "./globalAttributeNode";

export class SemaAttributeNode extends AstNode {

    private static readonly provider =
        new SemaAttributeDocumentationProvider();

    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly global: GlobalAttributeNode | undefined,
        public readonly presetKeyword: SourceValue<string> | undefined,
        public readonly presetValues: readonly ConstantFixedExpressionNode[]
    ) {
        super(AstKind.SemaAttribute);

        if (global) {
            this.adopt(global);
        }

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

        const global = this.global?.lookupSourceValue(offset);

        if (global) {
            return global;
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
        const attributes: string[] = [];

        if (this.global) {
            attributes.push("GLOBAL");
        }

        if (this.presetKeyword) {
            attributes.push(`PRESET, ${this.presetValues.length} values`);
        }

        return attributes.length > 0
            ? `SemaAttribute(${attributes.join(", ")})`
            : "SemaAttribute";
    }

    public override getChildren(): readonly AstNode[] {
        const children: AstNode[] = [];

        if (this.global) {
            children.push(this.global);
        }

        children.push(...this.presetValues);
        return children;
    }
}
