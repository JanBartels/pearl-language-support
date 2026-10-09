// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from "../../astKind";
import { AstLookupResult } from "../../astLookupResult";
import { AstNode } from "../../astNode";

import { SourceValue } from "../../../core/sourceValue";

import { DocumentationProvider } from "../../../documentation/documentationProvider";
import { ProblemDataAttributeDocumentationProvider } from "../../../documentation/problem/declarations/problemDataAttributeDocumentationProvider";

import { ProblemDataTypeNode } from "../types/problemDataTypeNode";
import { GlobalAttributeNode } from "./globalAttributeNode";
import { InitializationAttributeNode } from "./initializationAttributeNode";

export class ProblemDataAttributeNode extends AstNode {

    private static readonly provider =
        new ProblemDataAttributeDocumentationProvider();

    constructor(
        public readonly inv: SourceValue<string> | undefined,
        public readonly type: ProblemDataTypeNode | undefined,
        public readonly global: GlobalAttributeNode | undefined,
        public readonly initialization: InitializationAttributeNode | undefined
    ) {
        super(AstKind.ProblemDataAttribute);

        if (type) {
            this.adopt(type);
        }

        if (global) {
            this.adopt(global);
        }

        if (initialization) {
            this.adopt(initialization);
        }
    }

    override documentationProvider():
        DocumentationProvider<ProblemDataAttributeNode> {

        return ProblemDataAttributeNode.provider;
    }

    override lookupSourceValue(
        offset: number
    ): AstLookupResult | undefined {

        const inv =
            this.lookupOwnSourceValue(
                offset,
                this.inv
            );

        if (inv) {
            return inv;
        }

        const type =
            this.type?.lookupSourceValue(offset);

        if (type) {
            return type;
        }

        const global =
            this.global?.lookupSourceValue(offset);

        if (global) {
            return global;
        }

        return this.initialization?.lookupSourceValue(offset);
    }

    public override dumpLabel(): string {
        const attributes: string[] = [];

        if (this.inv) {
            attributes.push("INV");
        }

        if (this.global) {
            attributes.push("GLOBAL");
        }

        return attributes.length > 0
            ? `ProblemDataAttribute(${attributes.join(", ")})`
            : "ProblemDataAttribute";
    }

    public override getChildren(): readonly AstNode[] {
        const children: AstNode[] = [];

        if (this.type) {
            children.push(this.type);
        }

        if (this.global) {
            children.push(this.global);
        }

        if (this.initialization) {
            children.push(this.initialization);
        }

        return children;
    }
}
