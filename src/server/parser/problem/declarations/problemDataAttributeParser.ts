// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ParserBase } from "../../parserBase";

import { ProblemDataAttributeNode } from "../../../ast/problem/declarations/problemDataAttributeNode";

import { ProblemDataTypeParser } from "../types/problemDataTypeParser";
import { GlobalAttributeParser } from "./globalAttributeParser";
import { InitializationAttributeParser } from "./initializationAttributeParser";

export class ProblemDataAttributeParser extends ParserBase {

    override parse(): ProblemDataAttributeNode | undefined {
        this.skipTrivia();

        const invToken = this.acceptKeyword("INV");

        const type = new ProblemDataTypeParser(
            this.context
        ).parse();

        if (!type) {
            if (!invToken) {
                return undefined;
            }

            this.problems.error(
                this.location(),
                "Expected problem data type after 'INV'."
            );

            return new ProblemDataAttributeNode(
                this.tokenValue(invToken),
                undefined,
                undefined,
                undefined
            );
        }

        const global = new GlobalAttributeParser(
            this.context
        ).parse();

        const initialization = new InitializationAttributeParser(
            this.context
        ).parse();

        return new ProblemDataAttributeNode(
            invToken
                ? this.tokenValue(invToken)
                : undefined,
            type,
            global,
            initialization
        );
    }
}
