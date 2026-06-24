// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import {
  semanticTokenTypes,
  semanticTokenModifiers
} from './tokenTypes';
import { SemanticTokensLegend }
  from 'vscode-languageserver/node';

export type TokenType = typeof semanticTokenTypes[number];
export type TokenModifier = typeof semanticTokenModifiers[number];

export class TokenLegend {

  private typeIndex = new Map<string, number>();
  private modifierIndex = new Map<string, number>();

  constructor() {
    semanticTokenTypes.forEach((type, index) => {
      this.typeIndex.set(type, index);
    });

    semanticTokenModifiers.forEach((modifier, index) => {
      this.modifierIndex.set(modifier, index);
    });
  }

  getLegend(): SemanticTokensLegend {
    return {
      tokenTypes: [...semanticTokenTypes],
      tokenModifiers: [...semanticTokenModifiers]
    };
  }

  getType(type: TokenType): number {
    const index = this.typeIndex.get(type);
    if (index === undefined) {
      throw new Error(`Unknown semantic token type: ${type}`);
    }
    return index;
  }

  getModifierMask(modifiers: TokenModifier[]): number {
    let mask = 0;

    for (const mod of modifiers) {
      const index = this.modifierIndex.get(mod);
      if (index === undefined) {
        throw new Error(`Unknown semantic token modifier: ${mod}`);
      }

      mask |= (1 << index);
    }

    return mask;
  }
}
