// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SpcTaskAttributeNode } from "../../../ast/problem/specifications/spcTaskAttributeNode";
import { ParserBase } from "../../parserBase";
import { GlobalAttributeParser } from "../declarations/globalAttributeParser";

export class SpcTaskAttributeParser extends ParserBase {
    override parse(): SpcTaskAttributeNode | undefined {
        this.skipTrivia();
        const keyword = this.acceptKeyword("TASK");
        if (!keyword) { return undefined; }

        const global = new GlobalAttributeParser(this.context).parse();
        return new SpcTaskAttributeNode(this.tokenValue(keyword), global);
    }
}
