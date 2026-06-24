// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import {
  SemanticTokens,
  SemanticTokensBuilder,
  SemanticTokensParams
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentRegistry } from '../utility/documentRegistry';
import { Logger } from '../utility/logging/logger';
import { TokenLegend } from './tokenLegend';

export class SemanticTokenService {

  private documentTokenCache = new Map<string, SemanticTokens>();

  constructor(
    private documentRegistry: DocumentRegistry,
    private logger: Logger,
    private lgend: TokenLegend
  ) {}

  invalidate(uri: string): void {
    this.documentTokenCache.delete(uri);
  }

  clear(uri: string): void {
    this.documentTokenCache.delete(uri);
  }

  clearAll(): void {
    this.documentTokenCache.clear();
  }

  async handleFull( params: SemanticTokensParams ): Promise<SemanticTokens> {

    const uri = params.textDocument.uri;

    const cached = this.documentTokenCache.get(uri);
    if (cached) {
      return cached;
    }

    const document = this.documentRegistry.get(uri);
    if (!document) {
      return { data: [] };
    }

    const tokens = this.computeTokens(document);

    this.documentTokenCache.set(uri, tokens);

    return tokens;
  }

  private computeTokens(document: TextDocument): SemanticTokens {

    this.logger.debug?.(`Computing semantic tokens for ${document.uri}`);

    const builder = new SemanticTokensBuilder();
/*
    const text = document.getText();
    const lines = text.split(/\r?\n/);

    // ---- Hier kommt deine echte Token-Logik rein ----

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];

      if (line.includes('TASK')) {
        const start = line.indexOf('TASK');
        builder.push(lineIndex, start, 4, 0, 0);
      }
    }
*/
    return builder.build();
  }
}
