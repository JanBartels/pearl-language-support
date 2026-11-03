// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { SourceOffset } from '../../../core/sourceOffset';
import { AstKind } from '../../astKind';
import type { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';
import { TaskingTimeClauseNode } from './taskingTimeClauseNode';
import { TaskingFrequencyNode } from './taskingFrequencyNode';

/** (AT | AFTER) ... [ALL ...] | ALL ...; at least one clause is present. */
export class TaskingTimedStartNode extends AstNode {
    constructor(
        public readonly initial: TaskingTimeClauseNode | undefined,
        public readonly frequency: TaskingFrequencyNode | undefined
    ) {
        super(AstKind.TaskingTimedStart);
        if (initial) this.adopt(initial);
        if (frequency) this.adopt(frequency);
    }

    override documentationProvider(): undefined { return undefined; }
    override getChildren(): readonly AstNode[] {
        return [...(this.initial ? [this.initial] : []), ...(this.frequency ? [this.frequency] : [])];
    }
    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        for (const child of this.getChildren()) {
            const match = child.lookupSourceValue(position);
            if (match) return match;
        }
        return undefined;
    }
}
