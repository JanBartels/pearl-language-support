// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ParserBase } from "../../parserBase";

import { DclAttributeNode } from "../../../ast/problem/declarations/dclAttributeNode";

import { ProblemDataAttributeParser } from "./problemDataAttributeParser";
import { SemaAttributeParser } from "./semaAttributeParser";
import { BoltAttributeParser } from "./boltAttributeParser";
import { DclDationAttributeParser } from "./dclDationAttributeParser";

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

        const dation = new DclDationAttributeParser(this.context).parse();
        if (dation) {
            return dation;
        }

        return new ProblemDataAttributeParser(
            this.context
        ).parse();
    }
}
