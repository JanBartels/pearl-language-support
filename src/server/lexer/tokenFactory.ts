// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Token, TokenKind } from './token';
import { Location } from '../core/location';

export function createToken(
  kind: TokenKind,
  location: Location,
  macroDefinition?: Location
): Token {

  return Object.freeze({
    kind,
    location,
    ...(macroDefinition ? { macroDefinition } : {})
  });
}
