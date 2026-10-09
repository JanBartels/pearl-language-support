// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ParserBase } from "../../parserBase";

import { SemaAttributeNode } from "../../../ast/problem/declarations/semaAttributeNode";
import { ConstantFixedExpressionNode } from "../../../ast/problem/expressions/constantFixedExpressionNode";

import { ConstantFixedExpressionParser } from "../expressions/constantFixedExpressionParser";
import { GlobalAttributeParser } from "./globalAttributeParser";

export class SemaAttributeParser extends ParserBase {

    override parse(): SemaAttributeNode | undefined {
        this.skipTrivia();

        const keyword = this.acceptKeyword("SEMA");

        if (!keyword) {
            return undefined;
        }

        const global = new GlobalAttributeParser(
            this.context
        ).parse();

        this.skipTrivia();

        const presetToken = this.acceptKeyword("PRESET");
        const presetKeyword = presetToken
            ? this.tokenValue(presetToken)
            : undefined;
        const presetValues = presetToken
            ? this.parsePresetValues()
            : [];

        return new SemaAttributeNode(
            this.tokenValue(keyword),
            global,
            presetKeyword,
            presetValues
        );
    }

    private parsePresetValues(): readonly ConstantFixedExpressionNode[] {
        const values: ConstantFixedExpressionNode[] = [];

        if (!this.expectLeftParenthesis(
            "Expected '(' after PRESET."
        )) {
            return values;
        }

        const first = new ConstantFixedExpressionParser(
            this.context
        ).parse();

        if (!first) {
            this.problems.error(
                this.location(),
                "Expected constant FIXED expression in PRESET."
            );

            this.synchronize([
                ")",
                ";",
                "TYPE",
                "DCL",
                "DECLARE",
                "MODEND"
            ]);

            this.acceptRightParenthesis();
            return values;
        }

        values.push(first);

        while (this.acceptComma()) {
            const value = new ConstantFixedExpressionParser(
                this.context
            ).parse();

            if (!value) {
                this.problems.error(
                    this.location(),
                    "Expected constant FIXED expression after ','."
                );

                this.synchronize([
                    ")",
                    ";",
                    "TYPE",
                    "DCL",
                    "DECLARE",
                    "MODEND"
                ]);

                break;
            }

            values.push(value);
        }

        this.expectRightParenthesis(
            "Expected ')' after PRESET list."
        );

        return values;
    }
}
