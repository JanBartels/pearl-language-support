// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../../core/sourceValue';
import { SourceOffset } from '../../../core/sourceOffset';
import { AstKind } from '../../astKind';
import { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';
import type { ExpressionNode } from '../expressions/expressionNode';

/** An actual parameter expression, still represented by source tokens.
 *
 * An empty token sequence is intentional: while editing, an argument slot can
 * exist immediately after an opening parenthesis or a comma.
 */
export class ActualParameterNode extends AstNode {
    constructor(
        public readonly tokens: readonly SourceValue<string>[],
        /** Optional expression AST; raw tokens remain available for unsupported syntax. */
        public readonly expression?: ExpressionNode
    ) {
        super(AstKind.ActualParameter);
        if (expression) this.adopt(expression);
    }

    override documentationProvider(): undefined { return undefined; }

    override getChildren(): readonly AstNode[] { return this.expression ? [this.expression] : []; }

    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        const expressionLookup = this.expression?.lookupSourceValue(position);
        if (expressionLookup) return expressionLookup;
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
