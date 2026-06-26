// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { TokenStream } from '../lexer/tokenStream';
import { TokenKind } from '../lexer/token';
import { Logger } from '../utility/logging/logger';

const DUMP_TOKENS = true;

export class Parser {

  constructor(
    private readonly stream: TokenStream,
    private readonly logger: Logger
  ) {}

  parse(): void {

    while (!this.stream.eof()) {

      if (DUMP_TOKENS) {

        const token = this.stream.current();
        const text = this.stream.tokenText(token);

        this.logger.debug?.(`Parser ${TokenKind[token.kind]} "${text}" @${token.location.span.start}`);
      }

      this.stream.next();
    }
  }
}
