// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Logger } from '../utility/logging/logger';

import { ProblemCollection } from '../core/problemCollection';
import { Location } from '../core/location';

import { Token, TokenKind } from '../lexer/token';
import { TokenStream } from '../lexer/tokenStream';

import { SourceFile } from "../source/sourceFile";
import { CharStream } from "../lexer/charStream";
import { Lexer } from "../lexer/lexer";
import { LexerTokenStream } from "../lexer/lexerTokenStream";

import { PreprocessorContext } from './preprocessorContext';
import { ExpansionStack } from './expansionStack';

type DirectiveHandler = () => void;

export class Preprocessor implements TokenStream {

    private currentToken!: Token;
    private readonly handlers = new Map<string, DirectiveHandler>();
    private readonly expansions = new ExpansionStack();

    constructor(
        private readonly input: TokenStream,
        private readonly context: PreprocessorContext,
        private readonly problems: ProblemCollection,
        private readonly logger: Logger
    ) {
        this.handlers.set("#define", this.handleDefine.bind(this));
        this.handlers.set("#else", this.handleElse.bind(this));
        this.handlers.set("#endif", this.handleEndif.bind(this));
        this.handlers.set("#ifdef", this.handleIfdef.bind(this));
        this.handlers.set("#ifndef", this.handleIfndef.bind(this));
        this.handlers.set("#include", this.handleInclude.bind(this));
        this.handlers.set("#undef", this.handleUndef.bind(this));

        this.next();
    }

    private currentStream(): TokenStream {
        return this.expansions.peek() ?? this.input;
    }

    tokenText(token: Token): string {
        const stream = this.currentStream();
        return stream.tokenText(token);
    }

    current(): Token {
        return this.currentToken;
    }

    peek(offset = 0): Token {
        // TODO
        // Für den Anfang genügt vermutlich offset==0.
        if (offset !== 0) {
            throw new Error("peek(offset) not implemented");
        }

        return this.currentToken;
    }

    eof(): boolean {

        // Solange Expansionen aktiv sind, ist der Präprozessor
        // niemals am Ende.
        if (!this.expansions.isEmpty()) {
            return false;
        }

        return this.input.eof();
    }

    next(): void {

        while (true) {

            // ----------------------------------------------------
            // Aktive Makroexpansion?
            // ----------------------------------------------------

            const expansion = this.expansions.peek();
            if (expansion) {

                if (expansion.eof()) {
                    this.expansions.pop();
                    continue;
                }

                this.currentToken = expansion.current();
                expansion.next();
                return;
            }

            // ----------------------------------------------------
            // Eingabestream erschöpft?
            // ----------------------------------------------------

            const stream = this.currentStream();
            if (stream.eof()) {
                this.currentToken = stream.current();
                return;
            }

            // ----------------------------------------------------
            // Direktiven und Makroersetzungen bearbeiten
            // ----------------------------------------------------

            const token = stream.current();
            if (stream === this.input) {
                switch (token.kind) {

                case TokenKind.PreprocessorDirective:
                    this.handleDirective(token);
                    continue;

                case TokenKind.InvalidDirective:
                    this.handleInvalidDirective(token);
                    continue;

                case TokenKind.Identifier: {

                    const name = stream.tokenText(token);
                    const replacement = this.context.macroTable.get(name);

                    if (replacement === undefined) {
                        // Kein Makro → Identifier durchreichen.
                        this.currentToken = token;
                        stream.next();
                        return;
                    }

                    if (replacement === null) {
                    // Makro ohne Ersetzungstext verschwindet einfach.
                        stream.next();
                        continue;
                    }

                    stream.next();
                    this.expandMacro(token, replacement);
                    continue;
                }
                }

            }

            this.currentToken = token;
            stream.next();
            return;

        }
    }

    private handleDirective(token: Token): void {

        const text = this.tokenText(token);

        this.logger.debug?.(`Preprocessor directive: "${text}"`);

        const handler = this.handlers.get(text);
        if (handler) {
            handler();
        } else {
            this.handleUnknownDirective();
        }
    }

    private handleInvalidDirective(token: Token): void {

        const text = this.tokenText(token);
        this.logger.debug?.(`Invalid directive: "${text}"`);
        this.handleUnknownDirective();
        
        this.input.next();
    }
    
    private handleDefine(): void {

        // "#define" konsumieren
        this.input.next();

        // Makronamen erwarten
        const nameToken = this.input.current();

        if (nameToken.kind !== TokenKind.Identifier) {

            this.problems.error(
                nameToken.location,
                "Expected macro name after #define."
            );

            this.skipToNextLine();
            return;
        }

        const name = this.input.tokenText(nameToken);

        // Makronamen konsumieren
        this.input.next();

        // Makro ohne Ersetzungstext?
        if (this.input.eof() || this.input.current().kind == TokenKind.Newline) {

            this.defineMacro(name,null,nameToken.location);
            return;
        }

        // Kommentar direkt nach dem Makronamen?
        if (this.input.current().kind == TokenKind.Comment) {
            this.defineMacro(name,null,nameToken.location);
            this.skipToNextLine();
            return;
        }

        // Ersetzungstext muss mit " beginnen.
        const start = this.input.current();

        if (this.input.tokenText(start) !== "\"") {

            this.problems.error(
                start.location,
                "Expected '\"' after macro name."
            );

            this.skipToNextLine();
            return;
        }

        // Öffnendes " konsumieren
        this.input.next();

        let replacement = "";

        while (!this.input.eof()) {

            const token = this.input.current();
            const text = this.input.tokenText(token);

            if (text === "\"") {

                // Schließendes "
                this.input.next();

                this.defineMacro(name, replacement, nameToken.location);

                // Rest der Zeile darf nur noch Kommentar/Newline sein.
                if (!this.input.eof()) {

                    const rest = this.input.current();

                    if (rest.kind != TokenKind.Newline &&
                        rest.kind != TokenKind.Comment) {

                        this.problems.error(
                            rest.location,
                            "Unexpected tokens after macro replacement."
                        );
                    }
                }

                this.skipToNextLine();
                return;
            }

            replacement += text;

            this.input.next();
        }

        this.problems.error(
            start.location,
            "Unterminated macro replacement text."
        );
    }

    private handleElse(): void {
        // Direktive selbst konsumieren
        this.input.next();
    }
    
    private handleEndif(): void {
        // Direktive selbst konsumieren
        this.input.next();
    }

    private handleIfdef(): void {
        // Direktive selbst konsumieren
        this.input.next();
    }
    
    private handleIfndef(): void {
        // Direktive selbst konsumieren
        this.input.next();
    }
    
    private handleInclude(): void {
        // Direktive selbst konsumieren
        this.input.next();
    }

    private handleUndef(): void {

        // "#undef" konsumieren
        this.input.next();

        const token = this.input.current();

        if (token.kind !== TokenKind.Identifier) {

            this.problems.error(
                token.location,
                "Expected macro name after #undef."
            );

            this.skipToNextLine();
            return;
        }

        const name = this.input.tokenText(token);

        // Makronamen konsumieren
        this.input.next();

        // Rest der Zeile prüfen
        if (!this.input.eof()) {

            const rest = this.input.current();

            if (rest.kind !== TokenKind.Newline &&
                rest.kind !== TokenKind.Comment) {

                this.problems.error(
                    rest.location,
                    "Unexpected tokens after #undef."
                );

                this.skipToNextLine();
                return;
            }
        }

        this.undefineMacro(
            name,
            token.location
        );

        this.skipToNextLine();
    }

    private handleUnknownDirective(): void {

        // Direktive konsumieren
        const directive = this.input.current();
        this.input.next();

        // Problem melden
        this.problems.error(
            directive.location,
            `Unknown preprocessor directive '${this.tokenText(directive)}'`
        );

        // Rest der Zeile überspringen
        this.skipToNextLine();
    }

    private skipToNextLine(): void {

        while (!this.input.eof()) {

            if (this.input.current().kind === TokenKind.Newline) {
                this.input.next();          // Newline ebenfalls konsumieren
                break;
            }

            this.input.next();
        }
    }

    private defineMacro(
        name: string,
        replacement: string | null,
        location: Location
    ): void {

        if (this.context.macroTable.define(name, replacement)) {
            this.problems.warning(location, `Macro '${name}' redefined.`);
        }

        this.logger.debug?.(`#define ${name} "${replacement}"`);
    }

    private undefineMacro(
        name: string,
        location: Location
    ): void {

        if (!this.context.macroTable.undefine(name)) {
            this.problems.warning(location, `Macro '${name}' is not defined.`);
        }

        this.logger.debug?.(`#undef ${name}`);
    }

    private expandMacro(
        macroToken: Token,
        replacement: string
    ): void {

        this.logger.debug?.(
            `Expand macro ${this.input.tokenText(macroToken)} -> "${replacement}"`
        );

        // Quelltext für den Makroersetzungstext erzeugen
        const sourceFile = new SourceFile(
            `<macro:${this.input.tokenText(macroToken)}>`,
            replacement
        );

        // Lexer darüber laufen lassen
        const charStream = new CharStream(sourceFile);

        const lexer = new Lexer(
            charStream,
            this.problems,
            this.logger
        );

        const tokens = lexer.tokenize();

        // TokenStream erzeugen
        const stream = new LexerTokenStream(
            tokens,
            sourceFile
        );

        // Auf den Expansionsstack legen
        this.expansions.push(stream);
    }
}
