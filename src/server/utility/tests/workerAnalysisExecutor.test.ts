// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { EventEmitter } from 'node:events';
import { performance } from 'node:perf_hooks';
import { test } from 'node:test';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Validator } from '../../validation/validator';
import type { PearlSettings } from '../../settings/pearlSettings';
import { encodeAnalysisResult } from '../transport/analysisResultTransport';
import { WorkerAnalysisExecutor, type AnalysisWorkerHandle, type WorkerAnalysisMetrics } from '../workerAnalysisExecutor';
import type { WorkerAnalyzeRequest, WorkerAnalysisResponse, WorkerAnalyzeResult } from '../analysisWorkerProtocol';
import type { AnalysisExecutionInput } from '../analysisExecutor';

const settings: PearlSettings = {
    maxNumberOfProblems: 100, traceServer: 'off',
    workingDirMode: 'file', warnOnCharTruncation: true, macros: {}
};
const quiet = { info() {}, warn() {}, error() {} };

class FakeWorker extends EventEmitter implements AnalysisWorkerHandle {
    readonly posted: WorkerAnalyzeRequest[] = [];
    readonly throwOnPost = { value: false };
    terminated = 0;
    postMessage(request: WorkerAnalyzeRequest): void {
        if (this.throwOnPost.value) throw new Error('post failed');
        this.posted.push(request);
    }
    terminate(): Promise<number> { this.terminated++; return Promise.resolve(1); }
    reply(response: WorkerAnalysisResponse): void { this.emit('message', response); }
    crash(reason = new Error('worker crashed')): void { this.emit('error', reason); }
}

function input(version = 1): AnalysisExecutionInput {
    return {
        source: {
            uri: 'file:///project/main.P', languageId: 'pearl', version,
            text: 'MODULE Main; PROBLEM; DCL A FIXED; MODEND;'
        },
        settings,
        includeSnapshots: { sources: [], resolutions: [] }
    };
}

async function wire() {
    const i = input();
    const result = await new Validator(quiet).analyze(
        TextDocument.create(i.source.uri, i.source.languageId, i.source.version, i.source.text),
        i.settings, { resolveInclude: () => null }
    );
    return encodeAnalysisResult(result);
}


function resultResponse(
    id: number, wire: WorkerAnalyzeResult['wire'], analyzeMs = 1, encodeMs = 1
): WorkerAnalyzeResult {
    const now = performance.timeOrigin + performance.now();
    return {
        type: 'result', id, wire, analyzeMs, encodeMs,
        workerReceivedAtMs: now - analyzeMs - encodeMs - 1,
        workerAnalyzeStartedAtMs: now - analyzeMs - encodeMs,
        workerResultPostedAtMs: now
    };
}

test('worker executor returns reconstructed class instances with metrics and identity', async () => {
    const fake = new FakeWorker();
    const timings: WorkerAnalysisMetrics[] = [];
    const logs: string[] = [];
    const executor = new WorkerAnalysisExecutor('worker.js', {
        onMetrics: m => timings.push(m),
        onLog: (_level, message) => logs.push(message)
    }, () => fake);
    const promise = executor.execute(input());
    assert.equal(fake.posted.length, 1);
    assert.equal(fake.posted[0]?.input.includeSnapshots.resolutions.length, 0);
    fake.reply({ type: 'log', id: 1, level: 'debug', message: 'analyzing' });
    fake.reply(resultResponse(1, structuredClone(await wire()), 12, 3));
    const result = await promise;
    assert.equal(result.getFile('file:///project/main.P'), result.rootAnalysis);
    assert.equal(typeof result.rootAnalysis.ast.lookupSourceValue, 'function');
    assert.equal(typeof result.rootAnalysis.symbolOccurrences.lookup, 'function');
    assert.equal(logs[0], 'analyzing');
    assert.equal(timings.length, 1);
    assert.equal(timings[0]?.analyzeMs, 12);
    assert.equal(timings[0]?.encodeMs, 3);
    assert.ok(timings[0]!.decodeMs >= 0);
    assert.ok(timings[0]!.queueMs >= 0);
    assert.ok(timings[0]!.requestPostMs >= 0);
    assert.ok(timings[0]!.requestTransferMs >= 0);
    assert.ok(timings[0]!.workerSetupMs >= 0);
    assert.ok(timings[0]!.resultTransferMs >= 0);
    assert.ok(Number.isFinite(timings[0]!.otherMs));
    executor.dispose();
    assert.equal(fake.terminated, 1);
});

test('one worker serializes requests FIFO without merging their source versions', async () => {
    const fake = new FakeWorker();
    const executor = new WorkerAnalysisExecutor('worker.js', {}, () => fake);
    const first = executor.execute(input(10));
    const second = executor.execute(input(11));
    assert.equal(fake.posted.length, 1);
    assert.equal(fake.posted[0]?.input.source.version, 10);
    fake.reply(resultResponse(1, await wire()));
    await first;
    assert.equal(fake.posted.length, 2);
    assert.equal(fake.posted[1]?.input.source.version, 11);
    fake.reply(resultResponse(2, await wire()));
    await second;
    executor.dispose();
});

test('worker rejects requests without closed-world include snapshots', async () => {
    const fake = new FakeWorker();
    const executor = new WorkerAnalysisExecutor('worker.js', {}, () => fake);
    const { includeSnapshots: _ignored, ...withoutSnapshots } = input();
    await assert.rejects(executor.execute(withoutSnapshots), /requires captured include snapshots/);
    assert.equal(fake.posted.length, 0);
    executor.dispose();
});

test('worker error response rejects one request but permits the next', async () => {
    const fake = new FakeWorker();
    const executor = new WorkerAnalysisExecutor('worker.js', {}, () => fake);
    const first = executor.execute(input());
    const second = executor.execute(input());
    fake.reply({ type: 'error', id: 1, name: 'SyntaxError', message: 'bad input' });
    await assert.rejects(first, e => e instanceof Error && e.name === 'SyntaxError' && e.message === 'bad input');
    assert.equal(fake.posted.length, 2);
    fake.reply(resultResponse(2, await wire(), 2));
    await second;
    executor.dispose();
});

test('unexpected response identity fails active and queued jobs', async () => {
    const fake = new FakeWorker();
    const executor = new WorkerAnalysisExecutor('worker.js', {}, () => fake);
    const first = executor.execute(input());
    const second = executor.execute(input());
    fake.reply({ type: 'error', id: 999, name: 'Error', message: 'unexpected' });
    await assert.rejects(first, /Unexpected analysis worker response identity/);
    await assert.rejects(second, /Unexpected analysis worker response identity/);
    await assert.rejects(executor.execute(input()), /Unexpected analysis worker response identity/);
    assert.equal(fake.terminated, 1);
});

test('worker crash fails pending jobs without silent local retry', async () => {
    const fake = new FakeWorker();
    const executor = new WorkerAnalysisExecutor('worker.js', {}, () => fake);
    const first = executor.execute(input());
    const second = executor.execute(input());
    fake.crash();
    await assert.rejects(first, /worker crashed/);
    await assert.rejects(second, /worker crashed/);
    assert.equal(fake.terminated, 1);
});

test('worker shutdown rejects active and queued jobs and refuses new work', async () => {
    const fake = new FakeWorker();
    const executor = new WorkerAnalysisExecutor('worker.js', {}, () => fake);
    const first = executor.execute(input());
    const second = executor.execute(input());
    executor.dispose();
    await assert.rejects(first, /shut down/);
    await assert.rejects(second, /shut down/);
    await assert.rejects(executor.execute(input()), /disposed/);
    executor.dispose();
    assert.equal(fake.terminated, 1);
});

test('worker dispatch errors reject one request and drain later requests', async () => {
    const fake = new FakeWorker();
    fake.throwOnPost.value = true;
    const executor = new WorkerAnalysisExecutor('worker.js', {}, () => fake);
    await assert.rejects(executor.execute(input()), /post failed/);
    fake.throwOnPost.value = false;
    const result = executor.execute(input());
    assert.equal(fake.posted.length, 1);
    fake.reply(resultResponse(2, await wire()));
    await result;
    executor.dispose();
});
