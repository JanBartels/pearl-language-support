// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ParserBase } from "../../parserBase";

import { SemaAttributeNode } from "../../../ast/problem/declarations/semaAttributeNode";

export class SemaAttributeParser extends ParserBase {

    override parse(): SemaAttributeNode | undefined {

        this.skipTrivia();

        const keyword =
            this.acceptKeyword("SEMA");

        if (!keyword) {
            return undefined;
        }

        return new SemaAttributeNode(
            this.tokenValue(keyword)
        );
    }
}
