// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from "../../../core/sourceValue";
import { SourceOffset } from "../../../core/sourceOffset";
import { AstKind } from "../../astKind";
import { AstNode } from "../../astNode";
import { AstLookupResult } from "../../astLookupResult";
import type { ExpressionNode } from "../expressions/expressionNode";

/** IndexRange ::= Constant [ : Constant ]; constant validity is semantic. */
export class CaseIndexRangeNode extends AstNode {
    constructor(
        public readonly lower: ExpressionNode | undefined,
        public readonly colon: SourceValue<string> | undefined,
        public readonly upper: ExpressionNode | undefined
    ) {
        super(AstKind.CaseIndexRange);
        if (lower) this.adopt(lower);
        if (upper) this.adopt(upper);
    }

    override documentationProvider(): undefined { return undefined; }

    override getChildren(): readonly AstNode[] {
        return [...(this.lower ? [this.lower] : []), ...(this.upper ? [this.upper] : [])];
    }

    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        return this.lower?.lookupSourceValue(position)
            ?? this.lookupOwnSourceValue(position, this.colon)
            ?? this.upper?.lookupSourceValue(position);
    }
}
