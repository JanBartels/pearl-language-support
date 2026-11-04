// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstNode } from "../../../ast/astNode";
import { TokenKind, type Token } from "../../../lexer/token";
import { ParserBase } from "../../parserBase";
import { BlockParser } from "./blockParser";
import { RepetitionParser } from "./repetitionParser";
import { IfStatementParser } from "./ifStatementParser";
import { CaseStatementParser } from "./caseStatementParser";
import { CallStatementParser } from "./callStatementParser";
import { ReturnStatementParser } from "./returnStatementParser";
import { GotoStatementParser } from "./gotoStatementParser";
import { IdentifierStatementTailParser } from "./identifierStatementTailParser";
import { EmptyStatementNode } from "../../../ast/problem/statements/emptyStatementNode";
import { SynchronizationStatementParser } from "./synchronizationStatementParser";
import { SemaSetStatementParser } from "./semaSetStatementParser";
import { AssignmentParser } from "./assignmentParser";
import { TaskingStatementParser } from "./taskingStatementParser";
import { InterruptStatementParser } from "./interruptStatementParser";
import { DationControlStatementParser } from "./dationControlStatementParser";
import { BinaryTransferStatementParser } from "./binaryTransferStatementParser";

/** All nested statement constructs are dispatched through this common entry point. */
export class StatementParser extends ParserBase {

    override parse(): AstNode | undefined {
        this.skipTrivia();

        if (this.isKeyword("BEGIN")) {
            return new BlockParser(this.context).parse();
        }

        if (this.isKeyword(["FOR", "FROM", "BY", "TO", "WHILE", "REPEAT"])) {
            return new RepetitionParser(this.context).parse();
        }

        if (this.isKeyword("IF")) {
            return new IfStatementParser(this.context).parse();
        }

        if (this.isKeyword("CASE")) {
            return new CaseStatementParser(this.context).parse();
        }

        if (this.isKeyword(["REQUEST", "RELEASE", "ENTER", "LEAVE", "RESERVE", "FREE"])) {
            return new SynchronizationStatementParser(this.context).parse();
        }

        if (this.isKeyword(["ENABLE", "DISABLE", "TRIGGER"])) {
            return new InterruptStatementParser(this.context).parse();
        }

        if (this.isKeyword(["READ", "WRITE"])) {
            // RTOS-UH also exposes READ(...) and WRITE(...) as compatibility
            // procedures (5.7.5). Their identifier-led calls must keep the
            // ordinary call AST and signature resolution. A parenthesized
            // first expression followed by FROM/TO is a transfer, however.
            if (this.isBinaryTransferCompatibilityCall()) {
                const identifier = this.acceptIdentifier()!;
                return new IdentifierStatementTailParser(this.context)
                    .parseAfterIdentifier(identifier);
            }
            return new BinaryTransferStatementParser(this.context).parse();
        }

        if (this.isKeyword(["OPEN", "CLOSE"])) {
            return new DationControlStatementParser(this.context).parse();
        }

        if (this.isKeyword("SEMASET")) {
            return new SemaSetStatementParser(this.context).parse();
        }

        if (this.isKeyword([
            "ACTIVATE", "TERMINATE", "SUSPEND", "CONTINUE", "RESUME", "PREVENT",
            "AT", "AFTER", "WHEN", "ALL", "EVERY", "UNTIL", "DURING"
        ])) {
            return new TaskingStatementParser(this.context).parse();
        }

        if (this.isKeyword("CALL")) {
            return new CallStatementParser(this.context).parse();
        }

        // CONT is a destination operator in RTOS-UH, not a value expression.
        if (this.isKeyword("CONT")) {
            return new AssignmentParser(this.context).parseContAssignment();
        }

        if (this.isKeyword("RETURN")) {
            return new ReturnStatementParser(this.context).parse();
        }

        if (this.isKeyword("GOTO")) {
            return new GotoStatementParser(this.context).parse();
        }

        // Labels, implicit calls and assignments share an identifier prefix.
        // The tail parser only commits to the forms established by the grammar.
        if (this.isIdentifier()) {
            const identifier = this.acceptIdentifier()!;
            const statement = new IdentifierStatementTailParser(this.context)
                .parseAfterIdentifier(identifier);
            if (statement) return statement;
            this.skipUnsupportedStatement();
            return undefined;
        }

        const empty = this.acceptOperator(";");
        if (empty) {
            return new EmptyStatementNode(this.tokenValue(empty));
        }

        // An unmatched conditional delimiter must not trap the parser in a loop.
        if (this.isKeyword(["THEN", "ELSE", "ALT", "OUT", "FIN"])) {
            this.problems.error(this.location(),
                `Unexpected '${this.tokenText()}' outside its conditional statement.`);
            this.next();
            return undefined;
        }

        this.skipUnsupportedStatement();
        return undefined;
    }

    /** Distinguish the old READ(...)/WRITE(...) calls from transfer syntax.
     *
     * The lexer intentionally keeps these names usable as identifiers because
     * they are also builtins. Only the complete leading parenthesized argument
     * list decides the ambiguity: a trailing ';' is an implicit call, while
     * FROM/TO (or another expression-list item) belongs to READ/WRITE.
     * This is a read-only lookahead; it emits no speculative diagnostics.
     */
    private isBinaryTransferCompatibilityCall(): boolean {
        const stream = this.context.stream;
        let offset = 1;
        const peek = (): Token => stream.peek(offset);
        const isTrivia = (token: Token): boolean =>
            token.kind === TokenKind.Newline || token.kind === TokenKind.Comment;

        while (isTrivia(peek())) offset++;
        if (!this.isOperator('(', peek())) return false;

        let depth = 0;
        while (true) {
            const token = peek();
            if (token.kind === TokenKind.EOF) return true; // incomplete call
            if (this.isOperator('(', token)) depth++;
            else if (this.isOperator(')', token)) {
                depth--;
                if (depth === 0) {
                    offset++;
                    while (isTrivia(peek())) offset++;
                    const next = peek();
                    return this.isOperator(';', next)
                        || next.kind === TokenKind.EOF
                        || this.isKeyword(['END', 'MODEND', 'FIN', 'ELSE', 'ALT', 'OUT'], next);
                }
            }
            offset++;
        }
    }

    private skipUnsupportedStatement(): void {
        while (!this.eof()) {
            this.skipTrivia();

            if (this.eof() || this.isKeyword([
                "END", "MODEND", "THEN", "ELSE", "ALT", "OUT", "FIN"
            ])) {
                return;
            }

            // Leave any nested structured statement to the shared statement parser.
            if (this.isKeyword(["BEGIN", "FOR", "WHILE", "REPEAT", "IF", "CASE"])) {
                return;
            }

            if (this.acceptOperator(";")) {
                return;
            }

            this.next();
        }
    }
}
