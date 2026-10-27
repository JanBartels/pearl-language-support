// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../../core/sourceValue';
import { SourceOffset } from '../../../core/sourceOffset';
import { AstKind } from '../../astKind';
import { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';

/** An actual parameter expression, still represented by source tokens.
 *
 * An empty token sequence is intentional: while editing, an argument slot can
 * exist immediately after an opening parenthesis or a comma.
 */
export class ActualParameterNode extends AstNode {
    constructor(public readonly tokens: readonly SourceValue<string>[]) {
        super(AstKind.ActualParameter);
    }

    override documentationProvider(): undefined { return undefined; }

    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        for (const token of this.tokens) {
            const found = this.lookupOwnSourceValue(position, token);
            if (found) return found;
        }
        return undefined;
    }

    override dumpLabel(): string {
        return `ActualParameter(${this.tokens.length} tokens)`;
    }
}
