// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from "../../astKind";
import { AstLookupResult } from "../../astLookupResult";
import { AstNode } from "../../astNode";

import { OneIdentifierOrListNode } from "../identifiers/oneIdentifierOrListNode";
import { DimensionAttributeNode } from "../dimensions/dimensionAttributeNode";

import { DclAttributeNode } from "./dclAttributeNode";

export class DclDeclarationSentenceNode extends AstNode {

    constructor(
        public readonly identifiers:
            OneIdentifierOrListNode,
        public readonly dimension:
            DimensionAttributeNode | undefined,
        public readonly attribute:
            DclAttributeNode | undefined
    ) {
        super(AstKind.DclDeclarationSentence);

        this.adopt(identifiers);

        if (dimension) {
            this.adopt(dimension);
        }

        if (attribute) {
            this.adopt(attribute);
        }
    }

    override documentationProvider(): undefined {
        return undefined;
    }

    override lookupSourceValue(
        offset: number
    ): AstLookupResult | undefined {

        const identifiers =
            this.identifiers.lookupSourceValue(offset);

        if (identifiers) {
            return identifiers;
        }

        const dimension =
            this.dimension?.lookupSourceValue(offset);

        if (dimension) {
            return dimension;
        }

        return this.attribute?.lookupSourceValue(offset);
    }

    public override dumpLabel(): string {
        return "DclDeclarationSentence";
    }

    public override getChildren(): readonly AstNode[] {

        const children: AstNode[] = [
            this.identifiers
        ];

        if (this.dimension) {
            children.push(this.dimension);
        }

        if (this.attribute) {
            children.push(this.attribute);
        }

        return children;
    }

}
