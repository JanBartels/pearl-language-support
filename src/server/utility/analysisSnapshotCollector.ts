// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { IncludeSourceDocument, IncludeSourceResolver } from '../preproc/includeSourceResolver';
import { createPredefinedMacroTable } from '../preproc/createPredefinedMacroTable';
import { ConditionalStack } from '../preproc/conditionalStack';
import { Preprocessor } from '../preproc/preprocessor';
import { PreprocessorContext } from '../preproc/preprocessorContext';
import { PreprocessorConditionalBlockCollection } from '../preproc/preprocessorConditionalBlockCollection';
import { PreprocessorConditionalBlockStack } from '../preproc/preprocessorConditionalBlockStack';
import { ProblemCollection } from '../core/problemCollection';
import { Lexer } from '../lexer/lexer';
import { FileSource } from '../source/fileSource';
import type { PearlSettings } from '../settings/pearlSettings';
import type { Logger } from './logging/logger';
import type {
    AnalysisIncludeResolutionSnapshot, AnalysisIncludeSourceSnapshotSet, AnalysisSourceSnapshot
} from './analysisSourceSnapshot';

/** The document side of capture needs versions in addition to the compiler's read-only text. */
export interface SnapshotSourceDocument extends IncludeSourceDocument {
    readonly languageId: string;
    readonly version: number;
}

/**
 * Capture-side access to editor-first documents and the filesystem.
 * DocumentRegistry implements this interface structurally. The compiler
 * continues to depend only on IncludeSourceResolver.
 */
export interface SnapshotSourceProvider extends IncludeSourceResolver {
    get(uri: string): SnapshotSourceDocument | null;
    resolveInclude(includingUri: string, includePath: string): SnapshotSourceDocument | null;
    resolveIncludeUri(includingUri: string, includePath: string): string;
}

/** The source changed during capture itself; the caller should reschedule. */
export class StaleAnalysisSnapshotError extends Error {
    constructor(readonly changedUris: readonly string[]) {
        super(`Source changed during snapshot capture: ${changedUris.join(', ')}`);
        this.name = 'StaleAnalysisSnapshotError';
    }
}

/** Records lookups performed by the REAL preprocessor, never guesses from source text. */
class RecordingIncludeSourceResolver implements IncludeSourceResolver {
    private readonly sources = new Map<string, AnalysisSourceSnapshot>();
    private readonly resolutions = new Map<string, AnalysisIncludeResolutionSnapshot>();

    constructor(private readonly provider: SnapshotSourceProvider, root: AnalysisSourceSnapshot) {
        this.sources.set(root.uri, { ...root });
    }

    resolveInclude(includingUri: string, includePath: string): IncludeSourceDocument | null {
        const document = this.provider.resolveInclude(includingUri, includePath);
        const targetUri = document?.uri ?? this.provider.resolveIncludeUri(includingUri, includePath);
        const resolution: AnalysisIncludeResolutionSnapshot = {
            includingUri, includePath, targetUri, found: document !== null
        };
        const key = JSON.stringify([includingUri, includePath]);
        const previousResolution = this.resolutions.get(key);
        if (previousResolution && (previousResolution.targetUri !== resolution.targetUri
            || previousResolution.found !== resolution.found)) {
            throw new StaleAnalysisSnapshotError([
                includingUri, previousResolution.targetUri, resolution.targetUri
            ]);
        }
        this.resolutions.set(key, resolution);

        if (!document) return null;

        // Capture text once, but check repeated opens for conflicting versions or content.
        const next: AnalysisSourceSnapshot = {
            uri: document.uri, languageId: document.languageId,
            version: document.version, text: document.getText()
        };
        const previous = this.sources.get(document.uri);
        if (previous && (previous.languageId !== next.languageId
            || previous.version !== next.version || previous.text !== next.text)) {
            throw new StaleAnalysisSnapshotError([document.uri]);
        }
        if (!previous) this.sources.set(document.uri, next);
        const captured = previous ?? next;
        // Never let the capture pass observe a changing document through getText().
        return { uri: captured.uri, getText: () => captured.text };
    }

    resolveIncludeUri(includingUri: string, includePath: string): string {
        const resolution = this.resolutions.get(JSON.stringify([includingUri, includePath]));
        if (!resolution) throw new Error(`Unrecorded include lookup: ${includingUri} -> ${includePath}`);
        return resolution.targetUri;
    }

    snapshot(rootUri: string): AnalysisIncludeSourceSnapshotSet {
        const sources = [...this.sources.values()].filter(source => source.uri !== rootUri)
            .map(source => Object.freeze({ ...source }));
        const resolutions = [...this.resolutions.values()].map(item => Object.freeze({ ...item }));
        return Object.freeze({
            sources: Object.freeze(sources),
            resolutions: Object.freeze(resolutions)
        });
    }
}

/**
 * Discovers the complete set of executed #include lookups using the existing
 * lexer and preprocessor. The expensive parser and semantic passes are NOT
 * run during capture. A subsequent executor may replay the closed-world input
 * without consulting editor documents or the filesystem.
 *
 * The collector owns neither analysis results nor registry invalidation.
 * The caller must revalidate after execution (and before publication) because
 * a future worker can run while sources are being edited.
 */
export class AnalysisSnapshotCollector {
    constructor(
        private readonly provider: SnapshotSourceProvider,
        private readonly logger: Logger
    ) {}

    collect(root: AnalysisSourceSnapshot, settings: PearlSettings): AnalysisIncludeSourceSnapshotSet {
        const recorder = new RecordingIncludeSourceResolver(this.provider, root);
        const problems = new ProblemCollection();
        const source = new FileSource(root.uri, root.text);
        const context = new PreprocessorContext(
            recorder,
            createPredefinedMacroTable(settings),
            new ConditionalStack(),
            new PreprocessorConditionalBlockStack()
        );
        // This is the same preprocessing entry point used by Validator. Inactive
        // branches and macro-dependent paths are therefore handled identically.
        Preprocessor.createExpanded(
            new Lexer(source, problems, this.logger).tokenize(),
            source, context, problems, [],
            new PreprocessorConditionalBlockCollection(), this.logger
        );
        return recorder.snapshot(root.uri);
    }

    /**
     * Check source identity, version AND content. A disk-backed document can
     * retain version 0 after changing, so version-only checks are insufficient.
     * Missing includes must still be missing, and all recorded resolutions must
     * still point at the same physical URI. No registry state is mutated.
     *
     * Returns physical URIs responsible for invalidating the capture; the LSP
     * orchestrator decides whether and how to queue a replacement analysis.
     * An optional, explicit didOpen proof can accept an unchanged disk-backed
     * INCLUDE becoming an editor document. The root still requires its exact
     * version; contents, language and all include resolutions remain strict.
     */
    changedSources(
        root: AnalysisSourceSnapshot,
        capture: AnalysisIncludeSourceSnapshotSet,
        acceptOpenedIncludeVersion?: (
            captured: AnalysisSourceSnapshot, current: SnapshotSourceDocument
        ) => boolean
    ): string[] {
        const changed = new Set<string>();
        for (const snapshot of [root, ...capture.sources]) {
            const current = this.provider.get(snapshot.uri);
            if (!current || current.uri !== snapshot.uri
                || current.languageId !== snapshot.languageId
                || current.getText() !== snapshot.text) {
                changed.add(snapshot.uri);
                continue;
            }
            if (current.version !== snapshot.version
                && (snapshot.uri === root.uri
                    || !acceptOpenedIncludeVersion?.(snapshot, current))) {
                changed.add(snapshot.uri);
            }
        }
        for (const resolution of capture.resolutions) {
            const currentTarget = this.provider.resolveIncludeUri(
                resolution.includingUri, resolution.includePath
            );
            if (currentTarget !== resolution.targetUri) {
                changed.add(resolution.includingUri);
                changed.add(resolution.targetUri);
                changed.add(currentTarget);
                continue;
            }
            const exists = this.provider.get(resolution.targetUri) !== null;
            if (exists !== resolution.found) changed.add(resolution.targetUri);
        }
        return [...changed].sort();
    }
}
