// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ParserBase } from "../parserBase";
import { TranslationUnitNode } from "../../ast/module/translationUnitNode";
import { ModuleParser } from "./moduleParser";
import { CompilerControlParser } from "./compilerControlParser";
import { TokenKind } from '../../lexer/token';

export class TranslationUnitParser extends ParserBase {

    parse(): TranslationUnitNode {

        const root = new TranslationUnitNode();

        while (!this.eof()) {

            // Before MODULE/SHELLMODULE, compiler-option comments and their
            // optional semicolons belong to the translation-unit preamble.
            this.skipModulePreambleTrivia();
            if (this.eof()) break;

            const compilerControl = new CompilerControlParser(this.context).parse();

            if (compilerControl) {
                root.addChild(compilerControl);
                continue;
            }

            // CompilerControlParser may consume trailing trivia before EOF.
            if (this.eof()) break;

            if (this.isKeyword(["MODULE", "SHELLMODULE"])) {
                const module = new ModuleParser(this.context).parse();
                if (module) root.addChild(module);
                continue;
            }

            this.problems.error(
                this.location(),
                `Unexpected token '${this.tokenText()}'.`
            );

            this.next();
        }

        return root;
    }

    /** Skip comment/newline trivia and optional semicolons in the module preamble. */
    private skipModulePreambleTrivia(): void {
        while (!this.eof()) {
            if (this.tokenKind() === TokenKind.Newline ||
                this.tokenKind() === TokenKind.Comment ||
                this.isOperator(';')) {
                this.next();
                continue;
            }
            break;
        }
    }

}