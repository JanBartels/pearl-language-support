// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Location } from '../core';
import { extendLocation } from '../core/location';
import { ParserBase } from "./parserBase";
import { TranslationUnitNode } from "../ast/translationUnitNode";
import { ModuleParser } from "./moduleParser";

export class TranslationUnitParser extends ParserBase {

    parse(): TranslationUnitNode {

        const root = new TranslationUnitNode(
            this.location()
        );

        while (!this.eof()) {

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