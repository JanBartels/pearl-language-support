// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ParserBase } from "../../parserBase";

import { DclAttributeNode } from "../../../ast/problem/declarations/dclAttributeNode";

import { ProblemDataAttributeParser } from "./problemDataAttributeParser";
import { SemaAttributeParser } from "./semaAttributeParser";
import { BoltAttributeParser } from "./boltAttributeParser";

export class DclAttributeParser extends ParserBase {

    override parse(): DclAttributeNode | undefined {

        this.skipTrivia();

        const sema =
            new SemaAttributeParser(this.context).parse();

        if (sema) {
            return sema;
        }

        const bolt =
            new BoltAttributeParser(this.context).parse();

        if (bolt) {
            return bolt;
        }

        return new ProblemDataAttributeParser(
            this.context
        ).parse();
    }
}
