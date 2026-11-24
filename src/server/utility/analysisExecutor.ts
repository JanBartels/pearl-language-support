// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { PearlSettings } from '../settings/pearlSettings';
import type { AnalysisResult } from '../validation/analysisResult';
import type { AnalysisSourceSnapshot, AnalysisIncludeSourceSnapshotSet } from './analysisSourceSnapshot';

export type { AnalysisSourceSnapshot } from './analysisSourceSnapshot';

export interface AnalysisExecutionInput {
    readonly source: AnalysisSourceSnapshot;
    readonly settings: PearlSettings;
    /**
     * Closed-world include capture, provided by AnalysisSnapshotCollector in
     * the production server path. Optional only for legacy callers and tests.
     * A worker must never fall back to a live resolver when incomplete.
     */
    readonly includeSnapshots?: AnalysisIncludeSourceSnapshotSet;
}

/**
 * Executes the compiler pipeline for one complete translation unit.
 *
 * The executor does not schedule work, decide whether a request is current,
 * update DocumentRegistry, or publish diagnostics. The LSP orchestrator owns
 * those responsibilities. In particular, a returned result is not necessarily
 * eligible for publication: the caller must check its request id and versions.
 *
 * Both local and worker executors return live AnalysisResult instances.
 * Worker transport is an implementation detail of the executor boundary.
 */
export interface AnalysisExecutor {
    execute(input: AnalysisExecutionInput): Promise<AnalysisResult>;
    /** Optional lifecycle hook for executors owning resources such as threads. */
    dispose?(): void;
}
