// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ParserBase } from './parserBase';
import { ParserContext } from './parserContext';
import { SystemPartNode } from '../ast/systemPartNode';
import { SystemDeclarationParser } from './systemDeclarationParser';

export class SystemPartParser extends ParserBase {

    private readonly declarationParser: SystemDeclarationParser;

    constructor(context: ParserContext) {
        super(context);

        this.declarationParser = new SystemDeclarationParser(context);
    }

    parse(): SystemPartNode | undefined {

        this.skipTrivia();
        if (!this.acceptKeyword('SYSTEM')) {
            return undefined;
        }

        const node = new SystemPartNode(
            this.location()
        );

        if (!this.expectSemicolon()) {
            this.synchronize([
                'PROBLEM',
                'MODEND'
            ]);
        }

        while (!this.eof()) {

            if (this.isKeyword([
                'PROBLEM',
                'MODEND'
            ])) {
                break;
            }

            const declaration = this.declarationParser.parse();
            if (declaration) {
                node.addChild(declaration);
                continue;
            }

            this.next();
        }

        return node;
    }
}
