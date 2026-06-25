// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { TokenStream } from '../lexer/tokenStream';
import { Logger } from '../utility/logging/logger';

export class Parser {

  constructor(
    private readonly stream: TokenStream,
    private readonly logger: Logger
  ) {}

  parse(): void {

    while (!this.stream.eof()) {
      this.stream.next();
    }
  }
}
