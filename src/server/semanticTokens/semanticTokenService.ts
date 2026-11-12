// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { SemanticTokens, SemanticTokensParams } from 'vscode-languageserver/node';
import { DocumentRegistry } from '../utility/documentRegistry';
import { Logger } from '../utility/logging/logger';
import { TokenLegend } from './tokenLegend';
import { SourceHighlightMapper } from './sourceHighlightMapper';

/** Presentation only: compiler-owned classifications are mapped to LSP here. */
export class SemanticTokenService {
    private readonly mapper: SourceHighlightMapper;

    constructor(
        private readonly documentRegistry: DocumentRegistry,
        private readonly logger: Logger,
        legend: TokenLegend
    ) {
        this.mapper = new SourceHighlightMapper(legend);
    }

    // No URI-only result cache: an included file or settings may change
    // the analysis while the requested document version stays identical.

    async handleFull(params: SemanticTokensParams): Promise<SemanticTokens> {
        const uri = params.textDocument.uri;
        const document = this.documentRegistry.get(uri);
        if (!document) return { data: [] };

        const result = this.documentRegistry.getAnalysisResultForSource(uri, document.version);
        if (!result) return { data: [] };

        this.logger.debug?.(`Mapping semantic tokens for ${uri}`);
        return this.mapper.map(document, result.rootAnalysis.sourceHighlights);
    }
}
