// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AnalysisResult } from './analysisResult';  
import { Analysis } from './analysis';
import { FileSource } from '../source/fileSource';
import { Lexer } from '../lexer/lexer';

import { ProblemCollection } from '../core/problemCollection';

import { Preprocessor } from '../preproc/preprocessor';
import { PreprocessorContext } from '../preproc/preprocessorContext';
import { MacroTable } from '../preproc/macroTable';

import { Parser } from '../parser/parser';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { PearlSettings } from '../settings/pearlSettings';
import { WorkspaceManager } from '../utility/workspace';
import { DocumentRegistry } from '../utility/documentRegistry';
import { Logger } from '../utility/logging/logger';
import { ConditionalStack } from '../preproc/conditionalStack';

import { AstDumper } from '../ast/astDumper';

const DUMP_AST: boolean = true;

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

    const problems = new ProblemCollection();

    // ----------------------------
    // vordefinierte Macros anlegen
    // ----------------------------

    const macroTable = new MacroTable();
    for (const [name, value] of Object.entries(settings.macros ?? {})) {
        macroTable.define(
            name,
            value === "" ? null : value
        );
    }

    // ----------------------------
    // Lexer
    // ----------------------------

    const fileSource = FileSource.fromDocument(document);
    
    const lexer = new Lexer(fileSource, problems, this.logger);

    const tokens = lexer.tokenize();

    // ----------------------------
    // Preprocessor + Parser
    // ----------------------------

    const context = new PreprocessorContext(
      this.documentRegistry,
      macroTable,
      new ConditionalStack()
    );

    const preprocessor = Preprocessor.create(
        tokens,
        fileSource,
        context,
        problems,
        this.logger
    );

    const parser = new Parser(
      preprocessor,
      problems,
      this.logger
    );

    const ast = parser.parse();
    if ( DUMP_AST ) {
      this.logger.debug?.(
        AstDumper.dump(ast)
      );
    }

    // Semantik kommt später
    // analysis.semanticContext = semantic.analyze(ast);

    // ----------------------------
    // Analysis
    // ----------------------------

    this.logger.debug?.(
      `Analysis finished: ${problems.size()} problems`
    );

    const analysis = new Analysis(
        fileSource,
        tokens,
        ast,
        problems
    );

    return AnalysisResult.create(
        analysis,
        [analysis]
    );
  }
  
  handleConfigurationChanged(): void {
    this.logger.debug?.('Configuration changed – invalidating include cache');
    this.documentRegistry.invalidateAllIncludes();
  }

}
