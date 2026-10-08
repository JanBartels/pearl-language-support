// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ParserBase } from "../parserBase";
import { TranslationUnitNode } from "../../ast/module/translationUnitNode";
import { ModuleParser } from "./moduleParser";
import { CompilerModeParser } from "./compilerModeParser";

export class TranslationUnitParser extends ParserBase {

    parse(): TranslationUnitNode {

        const root = new TranslationUnitNode();

        while (!this.eof()) {

            const compilerMode = new CompilerModeParser(this.context).parse();

            if (compilerMode) {
                root.addChild(compilerMode);
                continue;
            }

            const module = new ModuleParser(this.context).parse();

            if (module) {
                root.addChild(module);
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

}