// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

/** A physical source captured at a single point in an analysis request. */
export interface AnalysisSourceSnapshot {
    readonly uri: string;
    readonly languageId: string;
    readonly version: number;
    readonly text: string;
}

/**
 * The resolved meaning of one #include lookup after macro expansion.
 *
 * A missing target is recorded explicitly, including its target URI, so that
 * replay preserves both the diagnostic and the filesystem watch dependency.
 * This is NOT an IncludeOccurrence: several executions may use the same lookup
 * while producing different source mappings and macro-dependent output.
 */
export interface AnalysisIncludeResolutionSnapshot {
    readonly includingUri: string;
    readonly includePath: string;
    readonly targetUri: string;
    readonly found: boolean;
}

/**
 * Transportable data for the include part of ONE translation unit.
 *
 * Together with AnalysisExecutionInput.source (the root), this constitutes
 * the input to a closed-world analysis. Sources are keyed by physical URI and
 * must have a single text/version within the unit. Resolutions are keyed by
 * (includingUri, includePath), not merely the textual include name, because
 * nested includes resolve relative to their respective including files.
 *
 * AnalysisSnapshotCollector constructs this capture from actually executed
 * lookups, including unsaved editor contents. No filesystem handles,
 * TextDocuments, callbacks,
 * LSP state, AST objects or source mappings are part of the data contract.
 */
export interface AnalysisIncludeSourceSnapshotSet {
    readonly sources: readonly AnalysisSourceSnapshot[];
    readonly resolutions: readonly AnalysisIncludeResolutionSnapshot[];
}
