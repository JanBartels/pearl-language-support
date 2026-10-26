// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceOffset } from '../../../core/sourceOffset';
import { AstKind } from "../../astKind";
import { AstLookupResult } from "../../astLookupResult";
import { AstNode } from "../../astNode";

import { OneIdentifierOrListNode } from "../identifiers/oneIdentifierOrListNode";
import { DimensionAttributeNode } from "../dimensions/dimensionAttributeNode";

import { ProblemDataTypeNode } from "./problemDataTypeNode";

export class StructComponentNode extends AstNode {

    constructor(
        public readonly identifiers:
            OneIdentifierOrListNode,
        public readonly dimension:
            DimensionAttributeNode | undefined,
        public readonly type:
            ProblemDataTypeNode
    ) {
        super(AstKind.StructComponent);

        this.adopt(identifiers);

        if (dimension) {
            this.adopt(dimension);
        }

        this.adopt(type);
    }

    override documentationProvider(): undefined {
        return undefined;
    }

    override lookupSourceValue(
        position: SourceOffset
    ): AstLookupResult | undefined {

        const identifiers =
            this.identifiers.lookupSourceValue(position);

        if (identifiers) {
            return identifiers;
        }

        const dimension =
            this.dimension?.lookupSourceValue(position);

        if (dimension) {
            return dimension;
        }

        return this.type.lookupSourceValue(position);
    }

    public override dumpLabel(): string {
        return "StructComponent";
    }

    public override getChildren(): readonly AstNode[] {

        const children: AstNode[] = [
            this.identifiers
        ];

        if (this.dimension) {
            children.push(this.dimension);
        }

        children.push(this.type);

        return children;
    }

}
