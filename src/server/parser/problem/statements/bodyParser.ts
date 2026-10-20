// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstNode } from "../../../ast/astNode";
import { ParserBase } from "../../parserBase";
import { DeclarationListParser } from "./declarationListParser";
import { StatementParser } from "./statementParser";

/** Common declaration-prefix / statement-sequence grammar, without its delimiters. */
export class BodyParser extends ParserBase {

    override parse(): AstNode | undefined {
        throw new Error("Use BodyParser.parseBody().");
    }

    parseBody(): AstNode[] {
        const nodes: AstNode[] = [];
        const declarations = new DeclarationListParser(this.context);
        let statementsStarted = false;

        while (!this.eof()) {
            this.skipTrivia();

            // END belongs to the caller (TASK, BEGIN or REPEAT).
            if (this.eof() || this.isKeyword(["END", "MODEND"])) {
                break;
            }

            if (declarations.isDeclarationStart()) {
                if (statementsStarted) {
                    this.problems.error(
                        this.location(),
                        "Declarations must precede statements in this body."
                    );
                }

                const declaration = declarations.parse();
                if (declaration) {
                    nodes.push(declaration);
                }
                continue;
            }

            statementsStarted = true;
            const statement = new StatementParser(this.context).parse();
            if (statement) {
                nodes.push(statement);
            }
            // The statement parser must consume input even for unsupported statements.
        }

        return nodes;
    }
}
