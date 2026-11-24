// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { TextDocument } from 'vscode-languageserver-textdocument';
import type { PearlSettings } from '../settings/pearlSettings';
import type { AnalysisResult } from '../validation/analysisResult';
import type { AnalysisExecutionInput, AnalysisExecutor } from './analysisExecutor';
import type { IncludeSourceResolver } from '../preproc/includeSourceResolver';
import { SnapshotIncludeSourceResolver } from './snapshotIncludeSourceResolver';

/** The existing Validator has exactly this compiler-facing entry point. */
export type LocalAnalysisFunction = (
    document: TextDocument,
    settings: PearlSettings,
    includeSourceResolver?: IncludeSourceResolver
) => Promise<AnalysisResult>;

/**
 * In-process implementation of AnalysisExecutor.
 *
 * Keep the synchronous work in the Validator's initial Promise creation:
 * adding an await or queueMicrotask here would conceal CPU time from the
 * analysis trace without making the validator interruptible.
 */
export class LocalAnalysisExecutor implements AnalysisExecutor {
    constructor(private readonly analyze: LocalAnalysisFunction) {}

    execute(input: AnalysisExecutionInput): Promise<AnalysisResult> {
        const { source, settings } = input;
        const document = TextDocument.create(
            source.uri, source.languageId, source.version, source.text
        );
        const resolver = input.includeSnapshots === undefined ? undefined
            : new SnapshotIncludeSourceResolver(source, input.includeSnapshots);
        return this.analyze(document, settings, resolver);
    }
}
