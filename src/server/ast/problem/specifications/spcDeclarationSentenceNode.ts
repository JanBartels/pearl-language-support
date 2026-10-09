// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from '../../astKind';
import { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';
import { VirtualDimensionListNode } from '../dimensions/virtualDimensionListNode';
import { OneIdentifierOrListNode } from '../identifiers/oneIdentifierOrListNode';
import { SpcAttributeNode } from './spcAttributeNode';

export class SpcDeclarationSentenceNode extends AstNode {
    constructor(
        public readonly identifiers: OneIdentifierOrListNode,
        public readonly virtualDimensions: VirtualDimensionListNode | undefined,
        public readonly attribute: SpcAttributeNode | undefined
    ) {
        super(AstKind.SpcDeclarationSentence);
        this.adopt(identifiers);

        if (virtualDimensions) {
            this.adopt(virtualDimensions);
        }
        if (attribute) {
            this.adopt(attribute);
        }
    }

    override documentationProvider(): undefined {
        return undefined;
    }

    override lookupSourceValue(offset: number): AstLookupResult | undefined {
        return this.identifiers.lookupSourceValue(offset)
            ?? this.virtualDimensions?.lookupSourceValue(offset)
            ?? this.attribute?.lookupSourceValue(offset);
    }

    override dumpLabel(): string {
        return 'SpcDeclarationSentence';
    }

    override getChildren(): readonly AstNode[] {
        const children: AstNode[] = [this.identifiers];

        if (this.virtualDimensions) {
            children.push(this.virtualDimensions);
        }
        if (this.attribute) {
            children.push(this.attribute);
        }

        return children;
    }
}
