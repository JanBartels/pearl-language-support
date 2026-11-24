// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import * as path from 'node:path';
import { WorkerAnalysisExecutor, type WorkerAnalysisMetrics } from '../workerAnalysisExecutor';
import { Validator } from '../../validation/validator';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { PearlSettings } from '../../settings/pearlSettings';
import type { AnalysisExecutionInput } from '../analysisExecutor';

const settings: PearlSettings = {
    maxNumberOfProblems: 100, warnOnCharTruncation: true,
    traceServer: 'off', workingDirMode: 'file', macros: {}
};
const quiet = { info() {}, warn() {}, error() {} };

// This is the REAL Worker thread and REAL Validator, not an in-memory mock.
test('actual Worker executes the closed-world pipeline and returns a usable AnalysisResult', { timeout: 30000 }, async () => {
    const mainUri = 'file:///worker-test/main.P';
    const includeUri = 'file:///worker-test/types.h';
    const text = '#include "types.h"\nMODULE Main; PROBLEM; DCL A REF Included; MODEND;';
    const included = 'TYPE Included FIXED;\n';
    const input: AnalysisExecutionInput = {
        source: { uri: mainUri, languageId: 'pearl', version: 12, text },
        settings,
        includeSnapshots: {
            sources: [{ uri: includeUri, languageId: 'pearl', version: 7, text: included }],
            resolutions: [{ includingUri: mainUri, includePath: 'types.h', targetUri: includeUri, found: true }]
        }
    };
    const samples: WorkerAnalysisMetrics[] = [];
    const executor = new WorkerAnalysisExecutor(
        path.join(__dirname, 'fixtures/analysisWorkerBootstrap.cjs'),
        { onMetrics: metrics => samples.push(metrics) }
    );
    try {
        const fromWorker = await executor.execute(input);
        const local = await new Validator(quiet).analyze(
            TextDocument.create(mainUri, 'pearl', 12, text), settings,
            {
                resolveInclude: () => ({ uri: includeUri, getText: () => included }),
                resolveIncludeUri: () => includeUri
            }
        );
        assert.deepEqual([...fromWorker.problems].map(p => p.message), [...local.problems].map(p => p.message));
        assert.deepEqual(fromWorker.includedSourceUris, local.includedSourceUris);
        assert.equal(fromWorker.includeOccurrences.length, local.includeOccurrences.length);
        assert.equal(fromWorker.rootAnalysis.ast.dumpLabel(), local.rootAnalysis.ast.dumpLabel());
        assert.equal(fromWorker.rootAnalysis.semanticContext?.bindings.size,
            local.rootAnalysis.semanticContext?.bindings.size);
        assert.equal(typeof fromWorker.rootAnalysis.symbolOccurrences.lookup, 'function');
        assert.equal(typeof fromWorker.rootAnalysis.ast.lookupSourceValue, 'function');
        assert.equal(samples.length, 1);
        const metric = samples[0]!;
        assert.ok(metric.totalMs >= metric.analyzeMs);
        assert.ok(metric.requestTransferMs >= 0);
        assert.ok(metric.workerSetupMs >= 0);
        assert.ok(metric.resultTransferMs >= 0);
        assert.ok(metric.decodeMs >= 0);
        assert.ok(Math.abs(metric.otherMs) < 15,
            `unexpected unaccounted time in real worker roundtrip: ${metric.otherMs}`);
    } finally {
        executor.dispose();
    }
});

test('actual Worker reports an uncaptured include and successfully handles the next request',
    { timeout: 30000 }, async () => {
    const uri = 'file:///worker-test/recovery.P';
    const executor = new WorkerAnalysisExecutor(path.join(__dirname, 'fixtures/analysisWorkerBootstrap.cjs'));
    try {
        const stale: AnalysisExecutionInput = {
            source: {
                uri, languageId: 'pearl', version: 1,
                text: '#include "not-captured.h"\nMODULE Failed; PROBLEM; MODEND;'
            },
            settings, includeSnapshots: { sources: [], resolutions: [] }
        };
        await assert.rejects(executor.execute(stale), /Uncaptured include lookup/);
        const corrected: AnalysisExecutionInput = {
            ...stale,
            source: { ...stale.source, version: 2, text: 'MODULE Recovered; PROBLEM; MODEND;' }
        };
        const result = await executor.execute(corrected);
        assert.equal(result.rootAnalysis.source.uri, uri);
        assert.equal(typeof result.getFile, 'function');
    } finally {
        executor.dispose();
    }
});
