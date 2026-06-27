// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ProblemCollection } from '../core/problemCollection';
import { TokenStream } from '../lexer/tokenStream';
import { Logger } from '../utility/logging/logger';

export class ParserContext {

    constructor(
        readonly stream: TokenStream,
        readonly problems: ProblemCollection,
        readonly logger: Logger
    ) {}

}
