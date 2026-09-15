// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from "../../astKind";
import { AstLookupResult } from "../../astLookupResult";
import { AstNode } from "../../astNode";

import { SourceValue } from "../../../core/sourceValue";

import { DocumentationProvider } from "../../../documentation/documentationProvider";
import { ConstantFixedTermDocumentationProvider } from "../../../documentation/problem/expressions/constantFixedTermDocumentationProvider";

import { ConstantFixedFactorNode } from "./constantFixedFactorNode";

export interface ConstantFixedTermTail {

    readonly operator: SourceValue<string>;
    readonly factor: ConstantFixedFactorNode;
}

export class ConstantFixedTermNode extends AstNode {

    private static readonly provider =
        new ConstantFixedTermDocumentationProvider();

    constructor(
        public readonly firstFactor: ConstantFixedFactorNode,
        public readonly tails: readonly ConstantFixedTermTail[]
    ) {
        super(AstKind.ConstantFixedTerm);

        this.adopt(firstFactor);

        for (const tail of tails) {
            this.adopt(tail.factor);
        }
    }

    override documentationProvider():
        DocumentationProvider<ConstantFixedTermNode> {

        return ConstantFixedTermNode.provider;
    }

    override lookupSourceValue(
        offset: number
    ): AstLookupResult | undefined {

        const first =
            this.firstFactor.lookupSourceValue(offset);

        if (first) {
            return first;
        }

        for (const tail of this.tails) {

            const operator =
                this.lookupOwnSourceValue(
                    offset,
                    tail.operator
                );

            if (operator) {
                return operator;
            }

            const factor =
                tail.factor.lookupSourceValue(offset);

            if (factor) {
                return factor;
            }
        }

        return undefined;
    }

    public override dumpLabel(): string {

        if (this.tails.length === 0) {
            return "ConstantFixedTerm";
        }

        const operators =
            this.tails
                .map(tail => tail.operator.value)
                .join(" ");

        return `ConstantFixedTerm(${operators})`;
    }
    
    public override getChildren(): readonly AstNode[] {

        return [
            this.firstFactor,
            ...this.tails.map(tail => tail.factor)
        ];
    }
}
