// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Location } from '../core';

export enum TokenKind {

  EOF,
  Newline,

  Whitespace,
  Comment,

  Identifier,

  NumberLiteral,
  StringLiteral,
  BitLiteral,

  Operator,
  Punctuation,

  Hash,
  PreprocessorDirective
}

export interface Token {

  /** Lexikalischer Typ */
  readonly kind: TokenKind;

  /** Wo steht dieses Token im Ursprungsdokument? */
  readonly location: Location;

  /**
   * Falls dieses Token durch Macro-Expansion entstanden ist:
   * Wo wurde das Macro definiert?
   */
  readonly macroDefinition?: Location;
}

export interface NumberToken extends Token {
  readonly numericValue: number;
}
