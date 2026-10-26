// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceOffset } from '../../../core/sourceOffset';
import { AstKind } from "../../astKind";
import { AstLookupResult } from "../../astLookupResult";
import { AstNode } from "../../astNode";

import { SourceValue } from "../../../core/sourceValue";

import { DocumentationProvider } from "../../../documentation/documentationProvider";
import { ConstantFixedExpressionDocumentationProvider } from "../../../documentation/problem/expressions/constantFixedExpressionDocumentationProvider";

import { ConstantFixedTermNode } from "./constantFixedTermNode";

export interface ConstantFixedExpressionTail {

    readonly operator: SourceValue<string>;
    readonly term: ConstantFixedTermNode;
}

export class ConstantFixedExpressionNode extends AstNode {

    private static readonly provider =
        new ConstantFixedExpressionDocumentationProvider();

    constructor(
        public readonly firstTerm: ConstantFixedTermNode,
        public readonly tails: readonly ConstantFixedExpressionTail[]
    ) {
        super(AstKind.ConstantFixedExpression);

        this.adopt(firstTerm);

        for (const tail of tails) {
            this.adopt(tail.term);
        }
    }

    override documentationProvider():
        DocumentationProvider<ConstantFixedExpressionNode> {

        return ConstantFixedExpressionNode.provider;
    }

    override lookupSourceValue(
        position: SourceOffset
    ): AstLookupResult | undefined {

        const first =
            this.firstTerm.lookupSourceValue(position);

        if (first) {
            return first;
        }

        for (const tail of this.tails) {

            const operator =
                this.lookupOwnSourceValue(
                    position,
                    tail.operator
                );

            if (operator) {
                return operator;
            }

            const term =
                tail.term.lookupSourceValue(position);

            if (term) {
                return term;
            }
        }

        return undefined;
    }

    public override dumpLabel(): string {

        if (this.tails.length === 0) {
            return "ConstantFixedExpression";
        }

        const operators =
            this.tails
                .map(tail => tail.operator.value)
                .join(" ");

        return `ConstantFixedExpression(${operators})`;
    }
    
    public override getChildren(): readonly AstNode[] {

        return [
            this.firstTerm,
            ...this.tails.map(tail => tail.term)
        ];
    }

}
