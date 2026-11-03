// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceOffset } from '../../../core/sourceOffset';
import { AstKind } from '../../astKind';
import { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';
import { VirtualDimensionListNode } from '../dimensions/virtualDimensionListNode';
import { ProblemDataTypeNode } from './problemDataTypeNode';

/** REF (,) FLOAT: an array reference, distinct from a reference to an
 * explicitly dimensioned array. The rank is part of the REF target. */
export class ReferenceArrayTargetNode extends AstNode {
    constructor(
        public readonly dimensions: VirtualDimensionListNode,
        public readonly elementType: ProblemDataTypeNode
    ) {
        super(AstKind.ReferenceArrayTarget);
        this.adopt(dimensions);
        this.adopt(elementType);
    }
    override documentationProvider(): undefined { return undefined; }
    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        return this.dimensions.lookupSourceValue(position)
            ?? this.elementType.lookupSourceValue(position);
    }
    override getChildren(): readonly AstNode[] { return [this.dimensions, this.elementType]; }
    override dumpLabel(): string { return `ReferenceArrayTarget(${this.dimensions.rank})`; }
}
