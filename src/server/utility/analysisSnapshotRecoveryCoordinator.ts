// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

/**
 * LSP-side coordination of late stale-snapshot reports with source events.
 *
 * An explicit source event has already invalidated all currently known owners
 * in DocumentRegistry. A worker whose dependency edges were not yet committed
 * can subsequently discover the same change. Retrying that worker must not
 * invalidate those owners a second time: doing so supersedes their newer
 * requests and destroys the typing debounce window.
 *
 * A change first discovered by snapshot validation is different. It still
 * needs full dependency invalidation, including previously committed owners.
 * The generation is observed before capturing the closed-world input, and
 * compared with per-source invalidation generations at recovery time.
 *
 * No compiler state or analysis result is owned here. DocumentRegistry owns
 * request identity and invalidation; the scheduler owns queued work.
 */
export interface SnapshotRecoveryRegistry {
    isCurrentAnalysis(rootUri: string, requestId: number): boolean;
    invalidateUri(uri: string): string[];
    clearAnalysisResult(rootUri: string): void;
}

export interface SnapshotRecoveryDecision {
    readonly skipped: boolean;
    /** Source changes already processed after this worker's capture. */
    readonly handledSources: readonly string[];
    /** Previously unobserved changes requiring dependency invalidation. */
    readonly invalidatedSources: readonly string[];
    readonly queuedRoots: readonly string[];
}

export class AnalysisSnapshotRecoveryCoordinator {
    private generation = 0;
    private readonly invalidatedAt = new Map<string, number>();

    constructor(
        private readonly registry: SnapshotRecoveryRegistry,
        private readonly enqueue: (rootUri: string) => void
    ) {}

    /** Call before invalidating a physical source for an LSP event. */
    noteSourceInvalidation(uri: string): void {
        this.invalidatedAt.set(uri, ++this.generation);
    }

    /** Taken immediately before collecting the immutable include snapshot. */
    captureGeneration(): number {
        return this.generation;
    }

    /**
     * A newer pending or running request already supersedes an obsolete one.
     * Otherwise, invalidate only changes not handled since capture. If every
     * change was handled, the current root must have been unknown to the old
     * dependency graph; requeue only that root, preserving other jobs.
     */
    recover(
        rootUri: string,
        requestId: number,
        capturedGeneration: number,
        changedUris: readonly string[]
    ): SnapshotRecoveryDecision {
        const empty: SnapshotRecoveryDecision = {
            skipped: true, handledSources: [], invalidatedSources: [], queuedRoots: []
        };
        if (!this.registry.isCurrentAnalysis(rootUri, requestId)) return empty;

        const handledSources: string[] = [];
        const invalidatedSources: string[] = [];
        const affected = new Set<string>();
        for (const uri of new Set(changedUris)) {
            if ((this.invalidatedAt.get(uri) ?? 0) > capturedGeneration) {
                handledSources.push(uri);
                continue;
            }
            // This source changed without an already processed LSP event.
            // One recovery invalidates known owners and records that generation
            // for other workers which captured their inputs earlier.
            this.noteSourceInvalidation(uri);
            invalidatedSources.push(uri);
            for (const unitUri of this.registry.invalidateUri(uri)) affected.add(unitUri);
        }

        if (!affected.has(rootUri)) {
            // The still-current root had no committed dependency edge, so the
            // original event could not have invalidated it. Only its own
            // result is stale, not the already queued work of other roots.
            this.registry.clearAnalysisResult(rootUri);
            affected.add(rootUri);
        }
        for (const unitUri of affected) this.enqueue(unitUri);
        return {
            skipped: false,
            handledSources,
            invalidatedSources,
            queuedRoots: [...affected]
        };
    }
}
