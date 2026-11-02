// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ParserBase } from "../../parserBase";
import { SynchronizationTypeNode } from "../../../ast/problem/types/synchronizationTypeNode";

export class SynchronizationTypeParser extends ParserBase {
    override parse(): SynchronizationTypeNode | undefined {
        this.skipTrivia();
        const keyword = this.acceptKeyword(["SEMA", "BOLT"]);
        return keyword
            ? new SynchronizationTypeNode(this.tokenValue(keyword))
            : undefined;
    }
}
