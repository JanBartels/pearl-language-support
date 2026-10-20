// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstNode } from "../../../ast/astNode";
import { ParserBase } from "../../parserBase";
import { DeclarationListParser } from "./declarationListParser";
import { StatementParser } from "./statementParser";

/** Common declaration-prefix / statement-sequence grammar, without its delimiters. */
export class BodyParser extends ParserBase {

    override parse(): AstNode | undefined {
        throw new Error("Use BodyParser.parseBody() or parseStatements().");
    }

    parseBody(): AstNode[] {
        return this.readStatements(["END", "MODEND"], true);
    }

    /** THEN/ELSE and ALT/OUT contain statements, not declarations or new scopes. */
    parseStatements(terminators: readonly string[]): AstNode[] {
        return this.readStatements(["END", "MODEND", ...terminators], false);
    }

    private readStatements(terminators: readonly string[], allowDeclarations: boolean): AstNode[] {
        const nodes: AstNode[] = [];
        const declarations = new DeclarationListParser(this.context);
        let statementsStarted = false;

        while (!this.eof()) {
            this.skipTrivia();
            if (this.eof() || this.isKeyword(terminators)) {
                break;
            }

            if (declarations.isDeclarationStart()) {
                if (!allowDeclarations) {
                    this.problems.error(this.location(),
                        "Declarations inside IF/CASE branches require BEGIN ... END.");
                } else if (statementsStarted) {
                    this.problems.error(this.location(),
                        "Declarations must precede statements in this body.");
                }

                const declaration = declarations.parse();
                // Invalid branch declarations must not enter the semantic declaration index.
                if (declaration && allowDeclarations) {
                    nodes.push(declaration);
                }
                continue;
            }

            statementsStarted = true;
            const statement = new StatementParser(this.context).parse();
            if (statement) {
                nodes.push(statement);
            }
            // StatementParser must advance even when it finds an unsupported statement.
        }

        return nodes;
    }
}
