// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstNode } from "../../../ast/astNode";

import { ParserBase } from "../../parserBase";

import { TaskDeclarationTailParser } from "./taskDeclarationTailParser";
import { ProcedureDeclarationTailParser } from "./procedureDeclarationTailParser";

export class ProblemNamedDeclarationParser extends ParserBase {

    override parse(): AstNode | undefined {
        this.skipTrivia();

        const identifier = this.acceptIdentifier();
        if (!identifier) {
            return undefined;
        }

        const name = this.tokenValue(identifier);

        if (!this.expectColon("Expected ':' after declaration name.")) {
            this.synchronize([
                ";",
                "MODEND"
            ]);
            this.acceptSemicolon();
            return undefined;
        }

        if (this.isKeyword("TASK")) {
            return new TaskDeclarationTailParser(
                this.context
            ).parseTail(name);
        }

        if (this.isKeyword(["PROC", "PROCEDURE"])) {
            return new ProcedureDeclarationTailParser(this.context).parseTail(name);
        }

        this.problems.error(
            this.location(),
            `Unsupported named PROBLEM declaration '${this.tokenText()}'.`
        );

        /*
         * Do not continue at a declaration-looking token inside an unsupported
         * PROC or other named construct. Its body may legally contain TYPE/DCL.
         */
        this.synchronize([
            "MODEND"
        ]);

        return undefined;
    }
}
