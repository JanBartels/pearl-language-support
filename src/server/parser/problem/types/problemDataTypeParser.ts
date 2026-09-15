// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ParserBase } from "../../parserBase";

import { ProblemDataTypeNode } from "../../../ast/problem/types/problemDataTypeNode";

import { SimpleTypeParser } from "./simpleTypeParser";
import { NamedTypeParser } from "./namedTypeParser";

export class ProblemDataTypeParser extends ParserBase {

    override parse(): ProblemDataTypeNode | undefined {

        this.skipTrivia();

        const simpleType =
            new SimpleTypeParser(this.context).parse();

        if (simpleType) {
            return simpleType;
        }

        return new NamedTypeParser(
            this.context
        ).parse();
    }
}
