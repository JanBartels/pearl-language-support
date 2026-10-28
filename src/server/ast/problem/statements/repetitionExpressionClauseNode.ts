// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from "../../../core/sourceValue";
import { AstNode } from "../../astNode";
import type { ExpressionNode } from "../expressions/expressionNode";
import { SourceOffset } from '../../../core/sourceOffset';
import { AstKind } from "../../astKind";
import { AstLookupResult } from "../../astLookupResult";
import { DocumentationProvider } from "../../../documentation/documentationProvider";
import { RepetitionExpressionDocumentationProvider } from
    "../../../documentation/problem/statements/repetitionExpressionDocumentationProvider";

/** A repetition header clause. Preserve tokens even when an expression AST is available. */
export class RepetitionExpressionClauseNode extends AstNode {

    private static readonly provider = new RepetitionExpressionDocumentationProvider();

    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly expressionTokens: readonly SourceValue<string>[],
        public readonly expression: ExpressionNode | undefined = undefined
    ) {
        super(AstKind.RepetitionExpressionClause);
        if (expression) this.adopt(expression);
    }

    override getChildren(): readonly AstNode[] {
        return this.expression ? [this.expression] : [];
    }

    override documentationProvider(): DocumentationProvider<RepetitionExpressionClauseNode> {
        return RepetitionExpressionClauseNode.provider;
    }

    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        const child = this.expression?.lookupSourceValue(position);
        if (child) return child;

        const own = this.lookupOwnSourceValue(position, this.keyword);
        if (own) {
            return own;
        }

        for (const token of this.expressionTokens) {
            const result = this.lookupOwnSourceValue(position, token);
            if (result) {
                return result;
            }
        }

        return undefined;
    }

    override dumpLabel(): string {
        return `RepetitionClause(${this.keyword.value})`;
    }
}
