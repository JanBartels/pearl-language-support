// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { IncludeSourceDocument, IncludeSourceResolver } from '../preproc/includeSourceResolver';
import type {
    AnalysisIncludeResolutionSnapshot,
    AnalysisIncludeSourceSnapshotSet,
    AnalysisSourceSnapshot
} from './analysisSourceSnapshot';

/**
 * Read-only, filesystem-free replay of captured include lookups.
 *
 * Unknown lookups are errors, NOT missing includes: a silently missing source
 * would change preprocessing semantics and corrupt dependency tracking.
 * This class does not record or collect inputs: AnalysisSnapshotCollector
 * captures executed lookups and the orchestrator verifies their freshness.
 */
export class SnapshotIncludeSourceResolver implements IncludeSourceResolver {
    private readonly documents = new Map<string, IncludeSourceDocument>();
    private readonly resolutions = new Map<string, Map<string, AnalysisIncludeResolutionSnapshot>>();

    constructor(root: AnalysisSourceSnapshot, snapshot: AnalysisIncludeSourceSnapshotSet) {
        const knownVersions = new Map<string, AnalysisSourceSnapshot>();
        for (const source of [root, ...snapshot.sources]) {
            const previous = knownVersions.get(source.uri);
            if (previous) {
                if (previous.version !== source.version || previous.languageId !== source.languageId
                    || previous.text !== source.text) {
                    throw new Error(`Conflicting source snapshots for ${source.uri}`);
                }
                continue;
            }
            const copy = { ...source };
            knownVersions.set(copy.uri, copy);
            this.documents.set(copy.uri, Object.freeze({
                uri: copy.uri,
                getText: () => copy.text
            }));
        }

        for (const resolution of snapshot.resolutions) {
            if (!knownVersions.has(resolution.includingUri)) {
                throw new Error(`Include lookup from uncaptured source: ${resolution.includingUri}`);
            }
            if (resolution.found && !knownVersions.has(resolution.targetUri)) {
                throw new Error(`Include target not captured: ${resolution.targetUri}`);
            }
            let byPath = this.resolutions.get(resolution.includingUri);
            if (!byPath) {
                byPath = new Map();
                this.resolutions.set(resolution.includingUri, byPath);
            }
            const previous = byPath.get(resolution.includePath);
            if (previous && (previous.targetUri !== resolution.targetUri
                || previous.found !== resolution.found)) {
                throw new Error(`Conflicting include lookup: ${resolution.includingUri} -> ${resolution.includePath}`);
            }
            byPath.set(resolution.includePath, { ...resolution });
        }
    }

    resolveInclude(includingUri: string, includePath: string): IncludeSourceDocument | null {
        const entry = this.lookup(includingUri, includePath);
        return entry.found ? this.documents.get(entry.targetUri)! : null;
    }

    resolveIncludeUri(includingUri: string, includePath: string): string {
        return this.lookup(includingUri, includePath).targetUri;
    }

    private lookup(includingUri: string, includePath: string): AnalysisIncludeResolutionSnapshot {
        const entry = this.resolutions.get(includingUri)?.get(includePath);
        if (!entry) {
            throw new Error(`Uncaptured include lookup: ${includingUri} -> ${includePath}`);
        }
        return entry;
    }
}
