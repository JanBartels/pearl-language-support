// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstNode } from "../../../ast/astNode";
import { ParserBase } from "../../parserBase";
import { TypeDeclarationParser } from "../declarations/typeDeclarationParser";
import { DclDeclarationParser } from "../declarations/dclDeclarationParser";
import { SpcDeclarationParser } from "../specifications/spcDeclarationParser";
import { FormatDeclarationTailParser } from "../declarations/formatDeclarationTailParser";
import { TokenKind } from "../../../lexer/token";

/**
 * The common declaration/identification prefix of TASK, BEGIN and REPEAT bodies.
 * The caller controls the transition from declarations to statements.
 */
export class DeclarationListParser extends ParserBase {

    override parse(): AstNode | undefined {
        this.skipTrivia();

        if (this.isFormatDeclarationStart()) {
            const identifier = this.acceptIdentifier()!;
            this.skipTrivia();
            const colon = this.acceptOperator(":");
            return new FormatDeclarationTailParser(this.context).parseTail(this.tokenValue(identifier),
                colon ? this.tokenValue(colon) : undefined);
        }

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

    private isFormatDeclarationStart(): boolean {
        if (!this.isIdentifier()) return false;
        let offset = 1;
        const peek = () => this.context.stream.peek(offset);
        const skip = () => { while ([TokenKind.Newline, TokenKind.Comment].includes(peek().kind)) offset++; };
        skip();
        if (!this.isOperator(':', peek())) return false;
        offset++;
        skip();
        return this.isKeyword('FORMAT', peek());
    }

    isDeclarationStart(): boolean {
        this.skipTrivia();
        return this.isKeyword(["TYPE", "DCL", "DECLARE", "SPC", "SPECIFY"])
            || this.isFormatDeclarationStart();
    }
}
