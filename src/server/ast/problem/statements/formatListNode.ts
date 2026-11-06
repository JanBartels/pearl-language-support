// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from '../../astKind';
import { AstNode } from '../../astNode';
import type { AstLookupResult } from '../../astLookupResult';
import type { SourceOffset } from '../../../core/sourceOffset';
import type { SourceValue } from '../../../core/sourceValue';
import type { FormatItemNode } from './formatItemNode';

/** Ordered, nested format sequence; do not expand repetitions during parsing. */
export class FormatListNode extends AstNode {
    constructor(
        public readonly opening: SourceValue<string> | undefined,
        public readonly items: readonly FormatItemNode[],
        public readonly commas: readonly SourceValue<string>[],
        public readonly closing: SourceValue<string> | undefined
    ) {
        super(AstKind.FormatList);
        this.adoptAll(items);
    }
    override documentationProvider(): undefined { return undefined; }
    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        const opening = this.lookupOwnSourceValue(position, this.opening);
        if (opening) return opening;
        for (const item of this.items) {
            const hit = item.lookupSourceValue(position);
            if (hit) return hit;
        }
        for (const comma of this.commas) {
            const hit = this.lookupOwnSourceValue(position, comma);
            if (hit) return hit;
        }
        return this.lookupOwnSourceValue(position, this.closing);
    }
    override getChildren(): readonly AstNode[] { return this.items; }
    override dumpLabel(): string { return `FormatList(${this.items.length})`; }
}
