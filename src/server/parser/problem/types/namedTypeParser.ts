// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ParserBase } from "../../parserBase";

import { NamedTypeNode } from "../../../ast/problem/types/namedTypeNode";

export class NamedTypeParser extends ParserBase {

    override parse(): NamedTypeNode | undefined {

        this.skipTrivia();

        const identifier = this.acceptIdentifier();
        if (!identifier) {
            return undefined;
        }

        return new NamedTypeNode(
            this.tokenValue(identifier)
        );
    }
}
