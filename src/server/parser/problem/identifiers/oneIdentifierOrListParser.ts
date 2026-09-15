// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from "../../../core/sourceValue";

import { ParserBase } from "../../parserBase";

import { OneIdentifierOrListNode } from "../../../ast/problem/identifiers/oneIdentifierOrListNode";

export class OneIdentifierOrListParser extends ParserBase {

    override parse(): OneIdentifierOrListNode | undefined {

        this.skipTrivia();

        /*
         * OneIdentifierOrList ::=
         *       Identifier
         *     | "(" Identifier [ "," Identifier ] ... ")"
         */

        if (this.acceptLeftParenthesis()) {
            return this.parseIdentifierList();
        }

        const identifier = this.acceptIdentifier();

        if (!identifier) {
            return undefined;
        }

        return new OneIdentifierOrListNode(
            false,
            [
                this.tokenValue(identifier)
            ]
        );
    }

    private parseIdentifierList():
        OneIdentifierOrListNode | undefined {

        const identifiers: SourceValue<string>[] = [];

        const first = this.expectIdentifier(
            "Expected identifier in identifier list."
        );

        if (!first) {

            /*
             * Die öffnende Klammer wurde bereits konsumiert.
             * Die lokale Produktion ist damit zerstört.
             * Bis zu ihrem Ende synchronisieren.
             */
            this.synchronize([
                ")"
            ]);

            this.acceptRightParenthesis();

            return undefined;
        }

        identifiers.push(
            this.tokenValue(first)
        );

        while (this.acceptComma()) {

            const identifier = this.expectIdentifier(
                "Expected identifier after ','."
            );

            if (!identifier) {

                this.synchronize([
                    ")"
                ]);

                break;
            }

            identifiers.push(
                this.tokenValue(identifier)
            );
        }

        /*
         * Falls ')' fehlt, meldet expectRightParenthesis() den Fehler,
         * lässt das aktuelle Token aber stehen. Dadurch kann der
         * aufrufende Parser z.B. den nachfolgenden Typ noch erkennen.
         */
        this.expectRightParenthesis();

        return new OneIdentifierOrListNode(
            true,
            identifiers
        );
    }

}
