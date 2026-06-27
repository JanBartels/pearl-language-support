// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { TokenStream } from '../lexer/tokenStream';
import { ProblemCollection } from '../core/problemCollection';

import { AstNode } from '../ast/astNode';
import { ParserContext } from './parserContext';
import { TranslationUnitParser } from './translationUnitParser';

import { Logger } from '../utility/logging/logger';

export class Parser {

    constructor(
        private readonly stream: TokenStream,
        private readonly problems: ProblemCollection,
        private readonly logger: Logger
    ) {}

    parse(): AstNode {

        const context = new ParserContext(
            this.stream,
            this.problems,
            this.logger
        );
        
        return new TranslationUnitParser(context).parse();
    }
}
