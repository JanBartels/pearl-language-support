// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from "../../astKind";
import { AstLookupResult } from "../../astLookupResult";
import { AstNode } from "../../astNode";

import { SourceValue } from "../../../core/sourceValue";

import { DocumentationProvider } from "../../../documentation/documentationProvider";
import { InitElementDocumentationProvider } from "../../../documentation/problem/declarations/initElementDocumentationProvider";

import { ConstantFixedExpressionNode } from "../expressions/constantFixedExpressionNode";

export type InitElementValue =
    | {
        readonly kind: "constantFixedExpression";
        readonly expression: ConstantFixedExpressionNode;
    }
    | {
        readonly kind: "floatingPoint";
        readonly literal: SourceValue<string>;
    }
    | {
        readonly kind: "characterString";
        readonly literal: SourceValue<string>;
    }
    | {
        readonly kind: "bitString";
        readonly literal: SourceValue<string>;
    };

export class InitElementNode extends AstNode {

    private static readonly provider =
        new InitElementDocumentationProvider();

    constructor(
        public readonly value: InitElementValue
    ) {
        super(AstKind.InitElement);

        if (value.kind === "constantFixedExpression") {
            this.adopt(value.expression);
        }
    }

    override documentationProvider():
        DocumentationProvider<InitElementNode> {

        return InitElementNode.provider;
    }

    override lookupSourceValue(
        offset: number
    ): AstLookupResult | undefined {

        switch (this.value.kind) {

            case "constantFixedExpression":
                return this.value.expression.lookupSourceValue(offset);

            case "floatingPoint":
            case "characterString":
            case "bitString":
                return this.lookupOwnSourceValue(
                    offset,
                    this.value.literal
                );
        }
    }

    public override dumpLabel(): string {

        switch (this.value.kind) {

            case "constantFixedExpression":
                return "InitElement(constant FIXED expression)";

            case "floatingPoint":
                return `InitElement(FLOAT ${this.value.literal.value})`;

            case "characterString":
                return `InitElement(CHAR ${this.value.literal.value})`;

            case "bitString":
                return `InitElement(BIT ${this.value.literal.value})`;
        }
    }

    public override getChildren(): readonly AstNode[] {

        if (this.value.kind === "constantFixedExpression") {
            return [this.value.expression];
        }

        return [];
    }
}
