// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from "../../../core/sourceValue";

import { ParserBase } from "../../parserBase";

import { OneIdentifierOrListNode } from "../../../ast/problem/identifiers/oneIdentifierOrListNode";

export class OneIdentifierOrListParser extends ParserBase {

    parse(): OneIdentifierOrListNode | undefined {

        this.skipTrivia();

        const parenthesized = this.acceptLeftParenthesis();

        this.skipTrivia();

        const identifier = this.acceptIdentifier();

        if (!identifier) {

            if (parenthesized) {
                this.problems.error(
                    this.location(),
                    "Expected identifier."
                );
            }

            return undefined;
        }

        const identifiers: SourceValue<string>[] = [
            this.tokenValue(identifier)
        ];

        while (this.acceptComma()) {

            const next = this.expectIdentifier();

            if (!next) {
                break;
            }

            identifiers.push(this.tokenValue(next));
        }

        if (parenthesized) {
            this.expectRightParenthesis();
        }

        return new OneIdentifierOrListNode(
            parenthesized,
            identifiers
        );
    }

}
