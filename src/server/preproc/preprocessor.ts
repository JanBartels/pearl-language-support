// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Logger } from '../utility/logging/logger';

import { ProblemCollection } from '../core/problemCollection';
import { Location } from '../core/location';

import { Token, TokenKind } from '../lexer/token';
import { TokenStream } from '../lexer/tokenStream';

import { Source } from "../source/source";
import { FileSource } from "../source/fileSource";
import { MacroSource } from "../source/macroSource";
import { CharStream } from "../lexer/charStream";
import { Lexer } from "../lexer/lexer";
import { LexerTokenStream } from "../lexer/lexerTokenStream";

import { PreprocessorContext } from './preprocessorContext';
import { ExpansionStack } from './expansionStack';

type DirectiveHandler = () => void;

export class Preprocessor implements TokenStream {

    private static readonly MAX_INCLUDE_DEPTH = 100;
    private currentToken!: Token;
    private readonly handlers = new Map<string, DirectiveHandler>();
    private readonly expansions = new ExpansionStack();

    constructor(
        private readonly input: TokenStream,
        private readonly source: Source,
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

                if (stream === this.input) {
                    while (!this.context.conditionals.isEmpty()) {
                        this.problems.error(stream.current().location,"Missing #endif.");
                        this.context.conditionals.leaveConditional();
                    }
                }                
                this.currentToken = stream.current();
                return;
            }
            const token = stream.current();

            // ----------------------------------------------------
            // Inaktiver Bereich?
            // ----------------------------------------------------

            if (!this.context.conditionals.isActive()) {

                if (token.kind === TokenKind.PreprocessorDirective) {

                    const directive = stream.tokenText(token).toLowerCase();

                    switch (directive) {

                    case "#ifdef":
                    case "#ifndef":
                    case "#else":
                    case "#endif":
                        this.handleDirective(token);
                        break;

                    default:
                        this.skipToNextLine();
                        break;
                    }

                } else {

                    stream.next();

                }

                continue;
            }

            // ----------------------------------------------------
            // Aktiver Bereich
            // Direktiven und Makroersetzungen bearbeiten
            // ----------------------------------------------------

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

                    if (!this.context.macroTable.has(name)) {
                        // Kein Makro → Identifier durchreichen.
                        this.currentToken = token;
                        stream.next();
                        return;
                    }

                    const replacement = this.context.macroTable.get(name);
                    if (replacement === null) {
                        // Makro ohne Ersetzungstext verschwindet einfach.
                        stream.next();
                        continue;
                    }

                    stream.next();
                    this.expandMacro(token, replacement!);
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

        const handler = this.handlers.get(text);
        if (handler) {
            handler();
        } else {
            this.handleUnknownDirective();
        }
    }

    private handleInvalidDirective(token: Token): void {

        const text = this.tokenText(token);
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

        const replacementStart = this.input.current().location.span.start;

        while (!this.input.eof()) {

            const token = this.input.current();
            const text = this.input.tokenText(token);

            if (text === "\"") {

                const replacement = this.source.getText({
                    start: replacementStart,
                    end: token.location.span.start
                });

                // Schließendes " konsumieren
                this.input.next();

                this.defineMacro(
                    name,
                    replacement,
                    nameToken.location
                );

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

            this.input.next();
        }
        this.problems.error(
            start.location,
            "Unterminated macro replacement text."
        );
    }

    private handleElse(): void {

        const token = this.input.current();

        if (this.context.conditionals.isEmpty()) {

            this.problems.error(
                token.location,
                "#else without matching #ifdef/#ifndef."
            );

            this.skipToNextLine();
            return;
        }

        if (this.context.conditionals.hasElse()) {
            this.problems.error(
                token.location,
                "Multiple #else directives."
            );
            this.skipToNextLine();
            return;
        }
        
        this.context.conditionals.handleElse();

        this.input.next();
        this.skipToNextLine();
    }

    private handleEndif(): void {

        const token = this.input.current();

        if (this.context.conditionals.isEmpty()) {

            this.problems.error(
                token.location,
                "#endif without matching #ifdef/#ifndef."
            );

            this.skipToNextLine();
            return;
        }

        this.context.conditionals.leaveConditional();

        this.input.next();
        this.skipToNextLine();
    }

    private handleIfdef(): void {

        const directive = this.input.current();

        // #ifdef konsumieren
        this.input.next();

        const token = this.input.current();

        if (token.kind !== TokenKind.Identifier) {

            this.problems.error(
                token.location,
                "Expected macro name after #ifdef."
            );

            this.skipToNextLine();
            return;
        }

        const name = this.input.tokenText(token);

        this.context.conditionals.enterIfdef(this.context.macroTable.has(name));

        this.input.next();
        this.skipToNextLine();
    }

    private handleIfndef(): void {

        const directive = this.input.current();

        // #ifndef konsumieren
        this.input.next();

        const token = this.input.current();

        if (token.kind !== TokenKind.Identifier) {

            this.problems.error(
                token.location,
                "Expected macro name after #ifndef."
            );

            this.skipToNextLine();
            return;
        }

        const name = this.input.tokenText(token);

        this.context.conditionals.enterIfndef(this.context.macroTable.has(name));

        this.input.next();
        this.skipToNextLine();
    }
    
    private handleInclude(): void {

        // #include braucht echte Datei für relative Adressierung im Dateisystem
        if (!(this.source instanceof FileSource)) {
            this.problems.error(
                this.input.current().location,
                "#include is not permitted while expanding a macro."
            );
            return;
        }

        // "#include" konsumieren
        this.input.next();

        const location = this.input.current().location;

        let path = "";
        let quoted = false;

        while (!this.input.eof()) {

            const token = this.input.current();
            switch (token.kind) {

            case TokenKind.Newline:

                if (quoted) {
                    this.problems.error(
                        location,
                        "Unterminated include file name."
                    );
                } else if (path.length === 0) {
                    this.problems.error(
                        location,
                        "Expected file name after #include."
                    );
                } else {
                    this.includeFile(path, location);
                }

                return;

            case TokenKind.Comment:

                if (quoted) {
                    this.problems.error(
                        location,
                        "Unterminated include file name."
                    );
                } else if (path.length === 0) {
                    this.problems.error(
                        location,
                        "Expected file name after #include."
                    );
                } else {
                    this.includeFile(path, location);
                }

                this.skipToNextLine();
                return;
            }

            const text = this.input.tokenText(token);

            // Doppelte Anführungszeichen dienen nur als Begrenzung.
            if (text === "\"") {

                quoted = !quoted;

                this.input.next();
                continue;
            }

            // Makronamen expandieren.
            if (token.kind === TokenKind.Identifier) {

                const replacement = this.context.macroTable.get(text);

                if (replacement === undefined) {

                    path += text;

                } else if (replacement !== null) {

                    // Stringkonstante im Include-Pfad entpacken.
                    if (replacement.length >= 2 &&
                        replacement.startsWith("'") &&
                        replacement.endsWith("'")) {

                        path += replacement.substring(
                            1,
                            replacement.length - 1
                        );

                    } else {

                        path += replacement;
                    }
                }

            } else {

                path += text;
            }

            this.input.next();
        }

        // EOF

        if (quoted) {

            this.problems.error(
                location,
                "Unterminated include file name."
            );

        } else if (path.length === 0) {

            this.problems.error(
                location,
                "Expected file name after #include."
            );

        } else {

            this.includeFile(path, location);
        }
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

        // this.logger.debug?.(`#define ${name} "${replacement}"`);
    }

    private undefineMacro(
        name: string,
        location: Location
    ): void {

        if (!this.context.macroTable.undefine(name)) {
            this.problems.warning(location, `Macro '${name}' is not defined.`);
        }

        // this.logger.debug?.(`#undef ${name}`);
    }

    private expandMacro(
        macroToken: Token,
        replacement: string
    ): void {

        // this.logger.debug?.(`Expand macro ${this.input.tokenText(macroToken)} -> "${replacement}"`);

        // Quelltext für den Makroersetzungstext erzeugen
        const macroSource = new MacroSource(
            macroToken.location,
            replacement
        );

        // Lexer darüber laufen lassen
        const charStream = new CharStream(macroSource);

        const lexer = new Lexer(
            charStream,
            this.problems,
            this.logger
        );

        const tokens = lexer.tokenize();

        // TokenStream erzeugen
        const stream = new LexerTokenStream(
            tokens,
            macroSource
        );

        if (this.expansions.size >= Preprocessor.MAX_INCLUDE_DEPTH) {
            this.problems.error(macroToken.location, `Maximum macro depth (${Preprocessor.MAX_INCLUDE_DEPTH}) exceeded.`);
            return;
        }
        const preprocessor = new Preprocessor(
            stream,
            macroSource,
            this.context,
            this.problems,
            this.logger
        );

        // Auf den Expansionsstack legen
        this.expansions.push(preprocessor);
    }

    private includeFile(includePath: string, location: Location): void {

        // this.logger.debug?.(`#include ${includePath}`);

        const document =
            this.context.documentRegistry.resolveInclude(
                this.source.uri,
                includePath
            );

        if (!document) {

            this.problems.error(
                location,
                `#include: file '${includePath}' not found.`
            );

            return;
        }

        const fileSource = FileSource.fromDocument(document);

        const lexer = new Lexer(
            new CharStream(fileSource),
            this.problems,
            this.logger
        );

        const stream = new LexerTokenStream(
            lexer.tokenize(),
            fileSource
        );

        if (this.expansions.size >= Preprocessor.MAX_INCLUDE_DEPTH) {
            this.problems.error(location, `Maximum include depth (${Preprocessor.MAX_INCLUDE_DEPTH}) exceeded.`);
            return;
        }
        const preprocessor = new Preprocessor(
            stream,
            fileSource,
            this.context,
            this.problems,
            this.logger
        );

        this.expansions.push(preprocessor);
    }
}
