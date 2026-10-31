// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Logger } from '../utility/logging/logger';

import { ProblemCollection } from '../core/problemCollection';
import { Span } from '../core/span';
import { Location } from '../core/location';

import { Token, TokenKind, CommentKind, isCommentToken } from '../lexer/token';
import { TokenStream } from '../lexer/tokenStream';
import { ArrayTokenStream } from '../lexer/arrayTokenStream';

import { Source } from "../source/source";
import { FileSource } from "../source/fileSource";
import { Lexer } from "../lexer/lexer";

import { MacroDefinition } from './macroDefinition';
import { MacroReference } from './macroReference';
import { PreprocessorContext } from './preprocessorContext';
import { ExternalPreprocessorResultBuilder, type ExternalPreprocessorResult } from './externalPreprocessorResult';
import { appendExpandedMacro } from './externalMacroExpansionWriter';
import { PreprocessorConditionalBlock } from "./preprocessorConditionalBlock";
import { PreprocessorConditionalBlockCollection } from "./preprocessorConditionalBlockCollection";

class LexerTokenStream implements TokenStream {

    private index = 0;

    constructor(
        private readonly tokens: readonly Token[],
        private readonly source: Source
    ) {}

    tokenText(token: Token): string {
        if (this.source !== token.location.source) {
            throw new Error('Token belongs to a different source.');
        }      
        return this.source.getText(token.location.span);
    }

    getText(span: Span): string {
       return this.source.getText(span);
    }

    current(): Token {
        return this.peek();
    }

    peek(offset = 0): Token {

        const index = Math.min(
            this.index + offset,
            this.tokens.length - 1
        );

        return this.tokens[index]!;
    }

    next(): void {

        if (!this.eof()) {
            this.index++;
        }
    }

    eof(): boolean {
        return this.current().kind === TokenKind.EOF;
    }
}

type DirectiveHandler = () => void;

export class Preprocessor {

    private static readonly MAX_INCLUDE_DEPTH = 100;
    private currentToken!: Token;
    private readonly handlers = new Map<string, DirectiveHandler>();
    private previousEmitted?: Location;

    /**
     * The conditional stacks are shared with included files.
     * Each preprocessor may close only the conditionals opened by its own input.
     */
    private readonly initialConditionalDepth: number;

    constructor(
        private readonly input: TokenStream,
        private readonly source: Source,
        private readonly context: PreprocessorContext,
        private readonly problems: ProblemCollection,
        private readonly macroReferences: MacroReference[],
        private readonly preprocessorConditionalBlocks: PreprocessorConditionalBlockCollection,
        private readonly logger: Logger,
        private readonly textOutput: ExternalPreprocessorResultBuilder,
        private readonly includeDepth = 0
    ) {
        this.initialConditionalDepth = context.conditionals.depth();

        this.handlers.set("#define", this.handleDefine.bind(this));
        this.handlers.set("#else", this.handleElse.bind(this));
        this.handlers.set("#endif", this.handleEndif.bind(this));
        this.handlers.set("#ifdef", this.handleIfdef.bind(this));
        this.handlers.set("#ifndef", this.handleIfndef.bind(this));
        this.handlers.set("#include", this.handleInclude.bind(this));
        this.handlers.set("#undef", this.handleUndef.bind(this));

        this.next();
    }

    /**
     * Compatibility entry point for parser tests that still expect a TokenStream.
     *
     * There is only one external-preprocessor implementation: expand to text,
     * then lex that complete text. In particular, macro replacements must not
     * be lexed independently, since they can form comment delimiters only after
     * adjacent fragments have been assembled.
     *
     * The caller-owned reference array is retained solely for the historical
     * API. Production analysis obtains references from ExternalPreprocessorResult.
     */
    static create(
        tokens: Token[],
        source: Source,
        context: PreprocessorContext,
        problems: ProblemCollection,
        macroReferences: MacroReference[],
        preprocessorConditionalBlocks: PreprocessorConditionalBlockCollection,
        logger: Logger
    ): TokenStream {
        const collected: MacroReference[] = [];
        const expanded = Preprocessor.createExpanded(
            tokens, source, context, problems, collected,
            preprocessorConditionalBlocks, logger
        );
        // createExpanded collects conditional-directive references through its
        // legacy argument, and ordinary macro uses through its result builder.
        // Both are represented exactly once in expanded.macroReferences.
        macroReferences.push(...expanded.macroReferences);
        const compilerTokens = new Lexer(expanded.source, problems, logger).tokenize();
        return new ArrayTokenStream(compilerTokens, expanded.source);
    }

    /**
     * External preprocessor. Produces complete character-level output plus LSP
     * metadata; a second lexer recognizes PEARL tokens in that complete text.
     * Internal RTOS-UH compiler directives are not part of this processing.
     */
    static createExpanded(
        tokens: Token[],
        source: Source,
        context: PreprocessorContext,
        problems: ProblemCollection,
        macroReferences: MacroReference[],
        preprocessorConditionalBlocks: PreprocessorConditionalBlockCollection,
        logger: Logger
    ): ExternalPreprocessorResult {
        const output = new ExternalPreprocessorResultBuilder(source);
        const input = new LexerTokenStream(tokens, source);
        const preprocessor = new Preprocessor(
            input, source, context, problems, macroReferences,
            preprocessorConditionalBlocks, logger, output
        );
        while (!preprocessor.eof()) preprocessor.next();
        for (const reference of macroReferences) output.addMacroReference(reference);
        for (const block of preprocessorConditionalBlocks) output.addConditionalBlock(block);
        const result = output.build();
        return result;
    }

    private emitWhitespaceBefore(location: Location): void {
        if (this.previousEmitted && this.previousEmitted.source === location.source
            && this.previousEmitted.span.end <= location.span.start) {
            const gap: Location = {
                source: location.source,
                span: { start: this.previousEmitted.span.end, end: location.span.start }
            };
            if (/^\s*$/.test(gap.source.getText(gap.span))) {
                this.textOutput.appendOriginal(gap);
            }
        }
    }

    private emitOriginal(token: Token): void {
        this.emitWhitespaceBefore(token.location);
        this.textOutput.appendOriginal(token.location);
        this.previousEmitted = token.location;
    }

    private tokenText(token: Token): string {
        return token.location.source.getText(token.location.span);
    }

    private eof(): boolean {
        return this.currentToken.kind === TokenKind.EOF;
    }

    private next(): void {
        const stream = this.input;
        while (true) {
            if (stream.eof()) {
                while (this.context.conditionals.depth() > this.initialConditionalDepth) {
                    this.problems.error(stream.current().location, "Missing #endif.");
                    this.context.conditionals.leaveConditional();
                    this.context.conditionalBlocks.leaveConditional();
                }
                this.currentToken = stream.current();
                return;
            }
            const token = stream.current();

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
                    // Preserve physical line breaks in disabled regions.
                    if (token.kind === TokenKind.Newline) this.emitSkippedNewline(token);
                    stream.next();
                }
                continue;
            }

            switch (token.kind) {
            case TokenKind.PreprocessorDirective:
                this.handleDirective(token);
                continue;
            case TokenKind.InvalidDirective:
                this.handleInvalidDirective(token);
                continue;
            case TokenKind.Identifier: {
                const name = stream.tokenText(token);
                const definition = this.context.macroTable.get(name);
                if (definition) {
                    this.emitWhitespaceBefore(token.location);
                    appendExpandedMacro(
                        this.textOutput, definition, token.location,
                        macro => this.context.macroTable.get(macro),
                        (location, message) => this.problems.error(location, message)
                    );
                    this.previousEmitted = token.location;
                    stream.next();
                    continue;
                }
                break;
            }
            }

            // Source comments serve editor features; compiler comments are
            // separately obtained by lexing the fully expanded output.
            if (isCommentToken(token) && token.commentKind === CommentKind.Block) {
                this.context.activeBlockComments.push(token);
            }
            this.currentToken = token;
            this.emitOriginal(token);
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

        const directiveLocation = this.input.current().location;

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

            this.defineMacro(name,null,nameToken.location,directiveLocation);
            return;
        }

        // Kommentar direkt nach dem Makronamen?
        if (this.input.current().kind == TokenKind.Comment) {
            this.defineMacro(name,null,nameToken.location,directiveLocation);
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
            // A replacement may not extend to the next physical line.
            // Preserve the next line for its own directive or source tokens.
            if (token.kind === TokenKind.Newline) {
                this.problems.error(start.location, "Unterminated macro replacement text.");
                return;
            }
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
                    nameToken.location,
                    directiveLocation,
                    { source: this.source, span: { start: replacementStart, end: token.location.span.start } }
                );

                // Ein Semikolon nach dem schliessenden Anfuehrungszeichen
                // beendet die #define-Direktive und ist kein Teil des
                // Ersetzungstextes.
                if (!this.input.eof() && this.input.tokenText(this.input.current()) === ";") {
                    this.input.next();
                }

                // Danach darf nur noch Kommentar/Newline folgen.
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

        const directive = this.input.current();

        if (this.context.conditionals.depth() <= this.initialConditionalDepth) {

            this.problems.error(
                directive.location,
                "#else without matching #ifdef/#ifndef."
            );

            this.skipToNextLine();
            return;
        }

        if (this.context.conditionalBlocks.hasElse()) {
            this.problems.error(
                directive.location,
                "Multiple #else directives."
            );
            this.skipToNextLine();
            return;
        }
        
        this.context.conditionals.handleElse();
        this.context.conditionalBlocks.handleElse(
            directive.location
        );

        this.input.next();
        this.skipToNextLine();
    }

    private handleEndif(): void {

        const directive = this.input.current();

        if (this.context.conditionals.depth() <= this.initialConditionalDepth) {

            this.problems.error(
                directive.location,
                "#endif without matching #ifdef/#ifndef."
            );

            this.skipToNextLine();
            return;
        }

        this.context.conditionals.leaveConditional();
        const open = this.context.conditionalBlocks.leaveConditional();
        this.preprocessorConditionalBlocks.add(
            new PreprocessorConditionalBlock(
                open.ifdef,
                open.macro,
                open.macroDefinition,
                open.ifLocation,
                open.elseLocation,
                directive.location,
                open.conditionSatisfied
            )
        );
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

        const macroDefinition = this.context.macroTable.get(name);
        this.context.conditionals.enterIfdef(macroDefinition !== undefined);
        this.context.conditionalBlocks.enterIfdef(
            name,
            macroDefinition,
            directive.location
        );        
        if ( macroDefinition ) {
            this.recordMacroReference(token, macroDefinition);
        }

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
        const macroDefinition = this.context.macroTable.get(name);
        this.context.conditionals.enterIfndef(macroDefinition !== undefined);
        this.context.conditionalBlocks.enterIfndef(
            name,
            macroDefinition,
            directive.location
        );        
        if ( macroDefinition ) {
            this.recordMacroReference(token, macroDefinition);
        }

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

                const macroDefinition = this.context.macroTable.get(text);

                if (macroDefinition === undefined) {

                    path += text;

                } else {
                    this.recordMacroReference(token, macroDefinition);

                    if (macroDefinition.replacement !== null) {

                        const replacement = macroDefinition.replacement;

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
        const macroDefinition = this.context.macroTable.get(name);
        if (macroDefinition) {
            this.recordMacroReference(token, macroDefinition);
        }

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

    /**
     * Retain a real physical line break when removing a directive or a disabled
     * source line. This separates adjacent PEARL tokens without inventing
     * spaces inside macro expansions (which may intentionally form comments).
     */
    private emitSkippedNewline(token: Token): void {
        this.textOutput.appendOriginal(token.location);
        this.previousEmitted = token.location;
    }

    private skipToNextLine(): void {
        while (!this.input.eof()) {
            if (this.input.current().kind === TokenKind.Newline) {
                this.emitSkippedNewline(this.input.current());
                this.input.next();
                break;
            }
            this.input.next();
        }
    }

    private defineMacro(
        name: string,
        replacement: string | null,
        location: Location,
        directiveLocation: Location,
        replacementLocation?: Location
    ): void {

        const redefined = this.context.macroTable.define(name, replacement, location, directiveLocation, replacementLocation);
        const definition = this.context.macroTable.get(name);
        if (definition) {
            this.context.macroDefinitions.push(definition);
        }
        if (redefined) {
            this.problems.warning(location, `Macro '${name}' redefined.`);
        }
    }

    private undefineMacro(
        name: string,
        location: Location
    ): void {

        if (!this.context.macroTable.undefine(name)) {
            this.problems.warning(location, `Macro '${name}' is not defined.`);
        }
    }

    private includeFile(includePath: string, location: Location): void {

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

        this.context.documentRegistry.addInclude(
            this.source.uri,
            document.uri
        );

        if (this.includeDepth >= Preprocessor.MAX_INCLUDE_DEPTH) {
            this.problems.error(location, `Maximum include depth (${Preprocessor.MAX_INCLUDE_DEPTH}) exceeded.`);
            return;
        }

        const fileSource = FileSource.fromDocument(document);
        const lexer = new Lexer(fileSource, this.problems, this.logger);
        const tokens = lexer.tokenize();
        const child = new Preprocessor(
            new LexerTokenStream(tokens, fileSource), fileSource, this.context,
            this.problems, this.macroReferences,
            this.preprocessorConditionalBlocks, this.logger,
            this.textOutput, this.includeDepth + 1
        );
        while (!child.eof()) child.next();
    }

    private recordMacroReference(
        token: Token,
        definition: MacroDefinition
    ): void {

        this.macroReferences.push({
            definition,
            location: token.location
        });
    }    
}
