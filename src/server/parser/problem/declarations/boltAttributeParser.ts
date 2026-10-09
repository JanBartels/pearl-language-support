// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ParserBase } from "../../parserBase";

import { BoltAttributeNode } from "../../../ast/problem/declarations/boltAttributeNode";

import { GlobalAttributeParser } from "./globalAttributeParser";

export class BoltAttributeParser extends ParserBase {

    override parse(): BoltAttributeNode | undefined {
        this.skipTrivia();

        const keyword = this.acceptKeyword("BOLT");

        if (!keyword) {
            return undefined;
        }

        const global = new GlobalAttributeParser(
            this.context
        ).parse();

        return new BoltAttributeNode(
            this.tokenValue(keyword),
            global
        );
    }
}
