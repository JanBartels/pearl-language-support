// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstNode } from "../../../ast/astNode";
import { ParserBase } from "../../parserBase";
import { TypeDeclarationParser } from "../declarations/typeDeclarationParser";
import { DclDeclarationParser } from "../declarations/dclDeclarationParser";
import { SpcDeclarationParser } from "../specifications/spcDeclarationParser";

/**
 * The common declaration/identification prefix of TASK, BEGIN and REPEAT bodies.
 * The caller controls the transition from declarations to statements.
 */
export class DeclarationListParser extends ParserBase {

    override parse(): AstNode | undefined {
        this.skipTrivia();

        if (this.isKeyword("TYPE")) {
            return new TypeDeclarationParser(this.context).parse();
        }

        if (this.isKeyword(["DCL", "DECLARE"])) {
            return new DclDeclarationParser(this.context).parse();
        }

        if (this.isKeyword(["SPC", "SPECIFY"])) {
            return new SpcDeclarationParser(this.context).parse();
        }

        return undefined;
    }

    isDeclarationStart(): boolean {
        this.skipTrivia();
        return this.isKeyword(["TYPE", "DCL", "DECLARE", "SPC", "SPECIFY"]);
    }
}
