// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from "../../../core/sourceValue";
import { AstNode } from "../../astNode";
import { AstKind } from "../../astKind";
import { AstLookupResult } from "../../astLookupResult";
import { DocumentationProvider } from "../../../documentation/documentationProvider";
import { RepetitionExpressionDocumentationProvider } from
    "../../../documentation/problem/statements/repetitionExpressionDocumentationProvider";

/** An expression-bearing header clause. Tokens remain source-faithful until expression parsing exists. */
export class RepetitionExpressionClauseNode extends AstNode {

    private static readonly provider = new RepetitionExpressionDocumentationProvider();

    constructor(
        public readonly keyword: SourceValue<string>,
        public readonly expressionTokens: readonly SourceValue<string>[]
    ) {
        super(AstKind.RepetitionExpressionClause);
    }

    override documentationProvider(): DocumentationProvider<RepetitionExpressionClauseNode> {
        return RepetitionExpressionClauseNode.provider;
    }

    override lookupSourceValue(offset: number): AstLookupResult | undefined {
        const own = this.lookupOwnSourceValue(offset, this.keyword);
        if (own) {
            return own;
        }

        for (const token of this.expressionTokens) {
            const result = this.lookupOwnSourceValue(offset, token);
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
