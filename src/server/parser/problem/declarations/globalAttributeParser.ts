// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ParserBase } from "../../parserBase";

import { GlobalAttributeNode } from "../../../ast/problem/declarations/globalAttributeNode";

export class GlobalAttributeParser extends ParserBase {

    override parse(): GlobalAttributeNode | undefined {
        this.skipTrivia();

        const keyword = this.acceptKeyword("GLOBAL");

        if (!keyword) {
            return undefined;
        }

        if (!this.acceptLeftParenthesis()) {
            return new GlobalAttributeNode(
                this.tokenValue(keyword),
                undefined
            );
        }

        const moduleToken = this.expectIdentifier(
            "Expected module identifier after 'GLOBAL('."
        );

        if (!moduleToken) {
            this.synchronizeGlobalModuleName();
            this.acceptRightParenthesis();

            return new GlobalAttributeNode(
                this.tokenValue(keyword),
                undefined
            );
        }

        if (!this.expectRightParenthesis(
            "Expected ')' after module identifier in GLOBAL attribute."
        )) {
            this.synchronizeGlobalModuleName();
            this.acceptRightParenthesis();
        }

        return new GlobalAttributeNode(
            this.tokenValue(keyword),
            this.tokenValue(moduleToken)
        );
    }

    private synchronizeGlobalModuleName(): void {
        this.synchronize([
            ")",
            "INIT",
            "INITIAL",
            "PRESET",
            "TYPE",
            "DCL",
            "DECLARE",
            "SPC",
            "SPECIFY",
            ",",
            ";"
        ]);
    }
}
