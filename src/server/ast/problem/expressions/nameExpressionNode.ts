// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceOffset } from '../../../core/sourceOffset';
import { AstKind } from '../../astKind';
import { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';
import { ExpressionNode } from './expressionNode';
import { NameSegmentNode } from './nameSegmentNode';

/** No attempt to classify procedure call, array access, or structure selection. */
export class NameExpressionNode extends ExpressionNode {
    constructor(public readonly segments: readonly NameSegmentNode[]) {
        super(AstKind.NameExpression);
        this.adoptAll(segments);
    }

    override documentationProvider(): undefined { return undefined; }

    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        for (const segment of this.segments) {
            const found = segment.lookupSourceValue(position);
            if (found) return found;
        }
        return undefined;
    }

    override getChildren(): readonly AstNode[] { return this.segments; }

    override dumpLabel(): string { return 'NameExpression'; }
}
