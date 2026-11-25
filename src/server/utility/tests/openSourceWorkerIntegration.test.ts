// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import * as path from 'node:path';
import { AnalysisSnapshotCollector, type SnapshotSourceDocument, type SnapshotSourceProvider } from '../analysisSnapshotCollector';
import { OpenSourceSnapshotVersionBridge } from '../openSourceSnapshotVersionBridge';
import { WorkerAnalysisExecutor } from '../workerAnalysisExecutor';
import { WorkerPoolAnalysisExecutor } from '../workerPoolAnalysisExecutor';
import type { AnalysisSourceSnapshot } from '../analysisSourceSnapshot';
import type { PearlSettings } from '../../settings/pearlSettings';

const settings: PearlSettings = {
    maxNumberOfProblems: 100, warnOnCharTruncation: true,
    traceServer: 'off', macros: {}
};
const logger = { info() {}, warn() {}, error() {} };
const includeUri = 'file:///in-flight-types/types.h';
const includeText = 'TYPE Included FIXED;\n';
const unitText = '#include "types.h"\nMODULE Main; PROBLEM; DCL A REF Included; MODEND;';

class Sources implements SnapshotSourceProvider {
    readonly files = new Map<string, AnalysisSourceSnapshot>();
    get(uri: string): SnapshotSourceDocument | null {
        const item = this.files.get(uri);
        return item ? { ...item, getText: () => item.text } : null;
    }
    resolveIncludeUri(uri: string, includePath: string): string {
        return new URL(includePath, uri).href;
    }
    resolveInclude(uri: string, includePath: string): SnapshotSourceDocument | null {
        return this.get(this.resolveIncludeUri(uri, includePath));
    }
}

test('four real workers retain all results when a shared disk include opens unchanged in the editor',
    { timeout: 30000 }, async () => {
    const files = new Sources();
    files.files.set(includeUri, { uri: includeUri, languageId: 'pearl', version: 0, text: includeText });
    const collector = new AnalysisSnapshotCollector(files, logger);
    const bridge = new OpenSourceSnapshotVersionBridge();
    const roots: AnalysisSourceSnapshot[] = Array.from({ length: 4 }, (_, n) => ({
        uri: `file:///in-flight-types/Unit${n + 1}.P`, languageId: 'pearl', version: 0, text: unitText
    }));
    const captures = roots.map(root => {
        files.files.set(root.uri, root);
        return collector.collect(root, settings);
    });
    assert.ok(captures.every(capture => capture.sources[0]?.version === 0));

    const workerFile = path.join(__dirname, 'fixtures/analysisWorkerBootstrap.cjs');
    const pool = new WorkerPoolAnalysisExecutor(4, () => new WorkerAnalysisExecutor(workerFile));
    try {
        const running = roots.map((source, i) => pool.execute({
            source, settings, includeSnapshots: captures[i]!
        }));

        // didOpen arrives after the four closed-world inputs were captured.
        const opened = { uri: includeUri, languageId: 'pearl', version: 1, text: includeText };
        files.files.set(includeUri, opened);
        bridge.didOpen(files.get(includeUri)!);
        bridge.didChangeContent(files.get(includeUri)!);

        const results = await Promise.all(running);
        for (let i = 0; i < roots.length; i++) {
            assert.deepEqual(collector.changedSources(roots[i]!, captures[i]!,
                bridge.accepts.bind(bridge)), []);
            assert.equal(results[i]!.rootAnalysis.source.uri, roots[i]!.uri);
            assert.deepEqual(results[i]!.includedSourceUris, [includeUri]);
            assert.equal(results[i]!.includeOccurrences.length, 1);
        }
        // A later unsaved edit must make all four snapshots stale.
        const edited = { ...opened, version: 2, text: includeText + 'DCL Added FIXED;' };
        files.files.set(includeUri, edited);
        bridge.didChangeContent(files.get(includeUri)!);
        assert.ok(roots.every((root, i) => collector.changedSources(root, captures[i]!,
            bridge.accepts.bind(bridge)).includes(includeUri)));
    } finally {
        pool.dispose();
    }
});
