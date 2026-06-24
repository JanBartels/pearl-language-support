// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AnalysisResult } from '../analysis/analysisResult';  
import { FileAnalysis } from '../analysis/fileAnalysis';

import { Token } from '../lexer/token';
import { Problem } from '../core/problem';

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

    const tokens: Token[] = [];       // TODO Lexer
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
