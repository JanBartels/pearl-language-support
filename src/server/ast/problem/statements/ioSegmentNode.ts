// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from '../../astKind';
import type { AstNode } from '../../astNode';
import type { AstLookupResult } from '../../astLookupResult';
import type { SourceOffset } from '../../../core/sourceOffset';
import type { SourceValue } from '../../../core/sourceValue';
import type { ExpressionNode } from '../expressions/expressionNode';
import { ExpressionNode as ExpressionBase } from '../expressions/expressionNode';
import type { NameExpressionNode } from '../expressions/nameExpressionNode';

/** A PEARL I/O array segment: array([index, ...] low : high).
 * A dedicated AST node prevents a segment from becoming a function call or
 * an ordinary indexed expression. Shared by binary and formatted I/O.
 */
export class IoSegmentNode extends ExpressionBase {
    constructor(
        public readonly array: NameExpressionNode,
        public readonly opening: SourceValue<string>,
        public readonly leadingIndices: readonly ExpressionNode[],
        public readonly commas: readonly SourceValue<string>[],
        public readonly lower: ExpressionNode | undefined,
        public readonly colon: SourceValue<string> | undefined,
        public readonly upper: ExpressionNode | undefined,
        public readonly closing: SourceValue<string> | undefined
    ) {
        super(AstKind.IoSegment);
        this.adopt(array);
        this.adoptAll(leadingIndices);
        if (lower) this.adopt(lower);
        if (upper) this.adopt(upper);
    }

    override documentationProvider(): undefined { return undefined; }

    override getChildren(): readonly AstNode[] {
        return [this.array, ...this.leadingIndices,
            ...(this.lower ? [this.lower] : []), ...(this.upper ? [this.upper] : [])];
    }

    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        const found = this.array.lookupSourceValue(position)
            ?? this.lookupOwnSourceValue(position, this.opening);
        if (found) return found;
        for (const expr of this.leadingIndices) {
            const hit = expr.lookupSourceValue(position);
            if (hit) return hit;
        }
        for (const comma of this.commas) {
            const hit = this.lookupOwnSourceValue(position, comma);
            if (hit) return hit;
        }
        return this.lower?.lookupSourceValue(position)
            ?? this.lookupOwnSourceValue(position, this.colon)
            ?? this.upper?.lookupSourceValue(position)
            ?? this.lookupOwnSourceValue(position, this.closing);
    }

    override dumpLabel(): string { return 'IoSegment'; }
}
