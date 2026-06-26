// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AnalysisResult } from '../analysis/analysisResult';  
import { FileAnalysis } from '../analysis/fileAnalysis';
import { SourceFile } from '../source/sourceFile';
import { CharStream } from '../lexer/charStream';
import { Lexer } from '../lexer/lexer';

import { ProblemCollection } from '../core/problemCollection';

import { LexerTokenStream } from '../lexer/lexerTokenStream';

import { Preprocessor } from '../preproc/preprocessor';
import { PreprocessorContext } from '../preproc/preprocessorContext';
import { MacroTable } from '../preproc/macroTable';

import { Parser } from '../parser/parser';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { PearlSettings } from '../settings/pearlSettings';
import { WorkspaceManager } from '../utility/workspace';
import { DocumentRegistry } from '../utility/documentRegistry';
import { Logger } from '../utility/logging/logger';

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

    // ----------------------------
    // Lexer
    // ----------------------------

    const sourceFile = new SourceFile(
      document.uri,
      document.getText()
    );

    const charStream = new CharStream(sourceFile);
    const lexer = new Lexer(charStream, this.logger);

    const tokens = lexer.tokenize();

    // ----------------------------
    // FileAnalysis
    // ----------------------------

    const problems = new ProblemCollection();

    const file = FileAnalysis.create(
      document.uri,
      tokens,
      problems
    );

    // ----------------------------
    // Preprocessor + Parser
    // ----------------------------

    const context = new PreprocessorContext(
      this.documentRegistry,
      new MacroTable()
    );

    const lexerStream = new LexerTokenStream(file.tokens, sourceFile);

    const preprocessor = new Preprocessor(
      lexerStream,
      context,
      problems,
      this.logger
    );

    const parser = new Parser(
      preprocessor,
      this.logger
    );

    parser.parse();

    // ----------------------------

    this.logger.debug?.(
      `Analysis finished: ${problems.size()} problems`
    );

    return AnalysisResult.create(
      document.uri,
      [file]
    );
  }
  handleConfigurationChanged(): void {
    this.logger.debug?.('Configuration changed – invalidating include cache');
    this.documentRegistry.invalidateAllIncludes();
  }

}
