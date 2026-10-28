// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceOffset } from '../../../core/sourceOffset';
import { SourceValue } from '../../../core/sourceValue';
import { AstKind } from '../../astKind';
import { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';
import { ExpressionNode } from './expressionNode';

/** Neutral parenthesized suffix: may be indices or actual parameters.
 * Only semantic resolution can distinguish A(i) from F(i).
 */
export class NameArgumentListNode extends AstNode {
    constructor(
        public readonly openParenthesis: SourceValue<string>,
        public readonly expressions: readonly (ExpressionNode | undefined)[],
        public readonly commas: readonly SourceValue<string>[],
        public readonly closeParenthesis?: SourceValue<string>
    ) {
        super(AstKind.NameArgumentList);
        for (const expression of expressions) if (expression) this.adopt(expression);
    }

    override documentationProvider(): undefined { return undefined; }

    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        const opening = this.lookupOwnSourceValue(position, this.openParenthesis);
        if (opening) return opening;
        for (const expression of this.expressions) {
            const found = expression?.lookupSourceValue(position);
            if (found) return found;
        }
        for (const comma of this.commas) {
            const found = this.lookupOwnSourceValue(position, comma);
            if (found) return found;
        }
        return this.lookupOwnSourceValue(position, this.closeParenthesis);
    }

    override getChildren(): readonly AstNode[] {
        return this.expressions.filter((expr): expr is ExpressionNode => expr !== undefined);
    }

    override dumpLabel(): string {
        return `NameArgumentList(${this.expressions.length} slots${this.closeParenthesis ? '' : ', unclosed'})`;
    }
}
