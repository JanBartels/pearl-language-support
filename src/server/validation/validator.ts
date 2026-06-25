// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AnalysisResult } from '../analysis/analysisResult';  
import { FileAnalysis } from '../analysis/fileAnalysis';
import { SourceFile } from '../source/sourceFile';
import { CharStream } from '../lexer/charStream';
import { Lexer } from '../lexer/lexer';

import { TokenKind, tokenText } from '../lexer/token'; // Debug
import { Problem } from '../core/problem';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { PearlSettings } from '../settings/pearlSettings';
import { WorkspaceManager } from '../utility/workspace';
import { DocumentRegistry } from '../utility/documentRegistry';
import { Logger } from '../utility/logging/logger';

const DUMP_TOKENS = true;

export class Validator {

  constructor(
    private workspaceManager: WorkspaceManager,
    private documentRegistry: DocumentRegistry,
    private logger: Logger
  ) {}

  async analyze(
    document: TextDocument,
    settings: PearlSettings
  ): Promise<AnalysisResult> {

    this.logger.debug?.(`Analyzing ${document.uri}`);
    this.logger.debug?.('[pearl] settings = ' + JSON.stringify(settings));

    const sourceFile = new SourceFile(document.uri, document.getText());
    const stream = new CharStream(sourceFile);
    const lexer = new Lexer(stream);
    const tokens = lexer.tokenize();

    if (DUMP_TOKENS) {
      this.logger.debug?.(`Lexer produced ${tokens.length} tokens`);
      for (let i = 0; i < Math.min(tokens.length, 20); i++) {
        const token = tokens[i]!;
        const text = tokenText(token, sourceFile);

        this.logger.debug?.(`[${i}] ${TokenKind[token.kind]} "${text}" @${token.location.span.start}`);
      }
    }

    const problems: Problem[] = [];   // TODO Analyse

    this.logger.debug?.(`Analysis finished: ${problems.length} problems`);

    const file = FileAnalysis.create(document.uri, tokens, problems);
    return AnalysisResult.create(document.uri, [file]);
  }

  handleConfigurationChanged(): void {
    this.logger.debug?.('Configuration changed – invalidating include cache');
    this.documentRegistry.invalidateAllIncludes();
  }

}
