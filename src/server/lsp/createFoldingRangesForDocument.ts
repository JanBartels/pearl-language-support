// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { FoldingRange } from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { AnalysisResult } from '../validation/analysisResult';
import type { IncludeOccurrence } from '../preproc/includeOccurrence';
import type { Logger } from '../utility/logging/logger';
import { FileSource } from '../source/fileSource';
import { Lexer } from '../lexer/lexer';
import { ProblemCollection } from '../core/problemCollection';
import { collectBlockComments } from '../validation/analysis';
import { FoldingRegionCollection } from '../folding/foldingRegionCollection';
import { CommentFoldingCollector } from '../lexer/commentFoldingCollector';
import { PhysicalPreprocessorFoldingCollector } from '../preproc/physicalPreprocessorFoldingCollector';
import { AstFoldingCollector } from '../ast/astFoldingCollector';
import { mapFoldingRegion } from './foldingMapper';

/**
 * Folding has a context-free physical layer (comments and conditional
 * directives) and an optional context-dependent AST layer.
 *
 * A header does not need an analyzed parent or an explicit CodeLens selection
 * to fold its own #ifdef/#ifndef regions and block comments. An exact include
 * occurrence is still required before attributing AST nodes to that header.
 */
export function createFoldingRangesForDocument(
    document: TextDocument,
    result: AnalysisResult | undefined,
    occurrence: IncludeOccurrence | undefined,
    logger: Logger
): FoldingRange[] {
    const physicalSource = FileSource.fromDocument(document);
    const physicalTokens = new Lexer(
        physicalSource, new ProblemCollection(), logger
    ).tokenize();
    const regions = new FoldingRegionCollection();

    // Physical syntax does not depend on macro evaluation, active branches,
    // a completed analysis or which execution of a header is selected.
    CommentFoldingCollector.collect(
        physicalSource, collectBlockComments(physicalTokens), regions
    );
    PhysicalPreprocessorFoldingCollector.collect(
        physicalSource, physicalTokens, regions
    );

    if (result) {
        const root = result.rootAnalysis;
        const rootDocument = root.source.uri === document.uri;
        // AST folding needs a specific execution's original Source object.
        const astSource = rootDocument ? root.source : occurrence?.source;
        if (astSource) {
            AstFoldingCollector.collect(astSource, root.ast, regions);
        }
    }

    const mapped: FoldingRange[] = [];
    const seen = new Set<string>();
    for (const region of regions) {
        if (region.location.source.uri !== document.uri) continue;
        if (region.location.span.start < 0
            || region.location.span.end > document.getText().length) continue;
        const folding = mapFoldingRegion(document, region);
        if (!folding) continue;
        const key = `${folding.startLine}:${folding.endLine}`;
        if (seen.has(key)) continue;
        seen.add(key);
        mapped.push(folding);
    }
    return mapped.sort((a, b) => a.startLine - b.startLine || a.endLine - b.endLine);
}
