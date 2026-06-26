// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Logger } from '../utility/logging/logger';

import { ProblemCollection } from '../core/problemCollection';
import { Location } from '../core/location';

import { Token, TokenKind } from '../lexer/token';
import { TokenStream } from '../lexer/tokenStream';

import { PreprocessorContext } from './preprocessorContext';

type DirectiveHandler = () => void;

export class Preprocessor implements TokenStream {

    private currentToken: Token;
    private readonly handlers = new Map<string, DirectiveHandler>();

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

    tokenText(token: Token): string {
        return this.input.tokenText(token);
    }

    private reportError(
        location: Location,
        message: string,
    ): void {

        this.problems.error(
            location,
            message
        );
    }

    private reportWarning(
        location: Location,
        message: string,
    ): void {

        this.problems.warning(
                location,
                message
        );
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
        return this.input.eof();
    }
    
    next(): void {

        while (true) {

            if (this.input.eof()) {
                this.currentToken = this.input.current();
                return;
            }

            const token = this.input.current();

            switch (token.kind) {

            case TokenKind.PreprocessorDirective:

                this.handleDirective(token);
                continue;

            case TokenKind.InvalidDirective:

                this.handleInvalidDirective(token);
                continue;

            default:
                this.currentToken = token;
                this.input.next();
                return;

            }
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
        // Direktive selbst konsumieren
        this.input.next();
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
        // Direktive selbst konsumieren
        this.input.next();
    }

    private handleUnknownDirective(): void {

        // Direktive konsumieren
        const directive = this.input.current();
        this.input.next();

        // Problem melden
        this.reportError(
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
}
