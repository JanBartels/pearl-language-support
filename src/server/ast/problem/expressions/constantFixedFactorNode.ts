// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from "../../astKind";
import { AstLookupResult } from "../../astLookupResult";
import { AstNode } from "../../astNode";

import { SourceValue } from "../../../core/sourceValue";

import { DocumentationProvider } from "../../../documentation/documentationProvider";
import { ConstantFixedFactorDocumentationProvider } from "../../../documentation/problem/expressions/constantFixedFactorDocumentationProvider";

import { ConstantFixedExpressionNode } from "./constantFixedExpressionNode";

export type ConstantFixedFactorOperand =
    | {
        readonly kind: "integer";
        readonly literal: SourceValue<string>;
        readonly precision: SourceValue<string> | undefined;
    }
    | {
        readonly kind: "identifier";
        readonly identifier: SourceValue<string>;
    }
    | {
        readonly kind: "parenthesized";
        readonly expression: ConstantFixedExpressionNode;
    }
    | {
        readonly kind: "toFixedCharacter";
        readonly keyword: SourceValue<string>;
        readonly literal: SourceValue<string>;
    }
    | {
        readonly kind: "toFixedBit";
        readonly keyword: SourceValue<string>;
        readonly literal: SourceValue<string>;
    };

export interface ConstantFixedFit {

    readonly keyword: SourceValue<string>;
    readonly expression: ConstantFixedExpressionNode;
}

export class ConstantFixedFactorNode extends AstNode {

    private static readonly provider =
        new ConstantFixedFactorDocumentationProvider();

    constructor(
        public readonly sign: SourceValue<string> | undefined,
        public readonly operand: ConstantFixedFactorOperand,
        public readonly fit: ConstantFixedFit | undefined
    ) {
        super(AstKind.ConstantFixedFactor);

        if (operand.kind === "parenthesized") {
            this.adopt(operand.expression);
        }

        if (fit) {
            this.adopt(fit.expression);
        }
    }

    override documentationProvider():
        DocumentationProvider<ConstantFixedFactorNode> {

        return ConstantFixedFactorNode.provider;
    }

    override lookupSourceValue(
        offset: number
    ): AstLookupResult | undefined {

        const sign =
            this.lookupOwnSourceValue(
                offset,
                this.sign
            );

        if (sign) {
            return sign;
        }

        const operand =
            this.lookupOperandSourceValue(offset);

        if (operand) {
            return operand;
        }

        if (this.fit) {

            const keyword =
                this.lookupOwnSourceValue(
                    offset,
                    this.fit.keyword
                );

            if (keyword) {
                return keyword;
            }

            return this.fit.expression.lookupSourceValue(offset);
        }

        return undefined;
    }

    private lookupOperandSourceValue(
        offset: number
    ): AstLookupResult | undefined {

        switch (this.operand.kind) {

            case "integer":
                return this.lookupOwnSourceValue(
                    offset,
                    this.operand.literal
                ) ?? this.lookupOwnSourceValue(
                    offset,
                    this.operand.precision
                );

            case "identifier":
                return this.lookupOwnSourceValue(
                    offset,
                    this.operand.identifier
                );

            case "parenthesized":
                return this.operand.expression.lookupSourceValue(offset);

            case "toFixedCharacter":
            case "toFixedBit":
                return this.lookupOwnSourceValue(
                    offset,
                    this.operand.keyword
                ) ?? this.lookupOwnSourceValue(
                    offset,
                    this.operand.literal
                );
        }
    }

    public override dumpLabel(): string {

        let operand: string;

        switch (this.operand.kind) {

            case "integer":

                operand =
                    this.operand.precision
                        ? `${this.operand.literal.value}(${this.operand.precision.value})`
                        : this.operand.literal.value;

                break;

            case "identifier":
                operand = this.operand.identifier.value;
                break;

            case "parenthesized":
                operand = "(...)";
                break;

            case "toFixedCharacter":
            case "toFixedBit":
                operand = `TOFIXED ${this.operand.literal.value}`;
                break;
        }

        const sign =
            this.sign?.value ?? "";

        const fit =
            this.fit ? " FIT ..." : "";

        return `ConstantFixedFactor(${sign}${operand}${fit})`;
    }

    public override getChildren(): readonly AstNode[] {

        const children: AstNode[] = [];

        if (this.operand.kind === "parenthesized") {
            children.push(this.operand.expression);
        }

        if (this.fit) {
            children.push(this.fit.expression);
        }

        return children;
    }

}
