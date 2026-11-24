// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import * as path from 'node:path';
import { WorkerPoolAnalysisExecutor } from '../workerPoolAnalysisExecutor';
import { AnalysisScheduler } from '../analysisScheduler';
import { WorkerAnalysisExecutor, type WorkerAnalysisMetrics } from '../workerAnalysisExecutor';
import type { AnalysisExecutor, AnalysisExecutionInput } from '../analysisExecutor';
import type { AnalysisResult } from '../../validation/analysisResult';

function input(uri: string): AnalysisExecutionInput {
    return {
        source: { uri, languageId: 'pearl', version: 1,
            text: 'MODULE Test; PROBLEM; DCL A FIXED; MODEND;' },
        settings: {
            maxNumberOfProblems: 100, traceServer: 'off', workingDirMode: 'file',
            warnOnCharTruncation: true, macros: {}
        },
        includeSnapshots: { sources: [], resolutions: [] }
    };
}

class ControlledExecutor implements AnalysisExecutor {
    readonly jobs: {
        uri: string;
        resolve: (result: AnalysisResult) => void;
        reject: (error: Error) => void;
    }[] = [];
    disposed = 0;
    execute(i: AnalysisExecutionInput): Promise<AnalysisResult> {
        return new Promise((resolve, reject) => this.jobs.push({ uri: i.source.uri, resolve, reject }));
    }
    dispose(): void { this.disposed++; }
}

function flush(): Promise<void> {
    return (async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); })();
}

test('two worker executors run simultaneously, queue overflow and reuse released worker', async () => {
    const workers = [new ControlledExecutor(), new ControlledExecutor()];
    const pool = new WorkerPoolAnalysisExecutor(2, i => workers[i]!);
    const a = pool.execute(input('A'));
    const b = pool.execute(input('B'));
    const c = pool.execute(input('C'));
    assert.deepEqual(workers.map(w => w.jobs.map(j => j.uri)), [['A'], ['B']]);
    const resultA = { rootAnalysis: 'A' } as unknown as AnalysisResult;
    const resultB = { rootAnalysis: 'B' } as unknown as AnalysisResult;
    const resultC = { rootAnalysis: 'C' } as unknown as AnalysisResult;
    workers[1]!.jobs[0]!.resolve(resultB);
    assert.equal(await b, resultB);
    await flush();
    assert.deepEqual(workers.map(w => w.jobs.map(j => j.uri)), [['A'], ['B', 'C']]);
    workers[0]!.jobs[0]!.resolve(resultA);
    workers[1]!.jobs[1]!.resolve(resultC);
    assert.equal(await a, resultA);
    assert.equal(await c, resultC);
    pool.dispose();
    assert.deepEqual(workers.map(w => w.disposed), [1, 1]);
});

test('a job error affects only its request; the healthy worker completes normally', async () => {
    const workers = [new ControlledExecutor(), new ControlledExecutor()];
    const pool = new WorkerPoolAnalysisExecutor(2, i => workers[i]!);
    const a = pool.execute(input('A'));
    const b = pool.execute(input('B'));
    const c = pool.execute(input('C'));
    workers[0]!.jobs[0]!.reject(new Error('failed A'));
    await assert.rejects(a, /failed A/);
    await flush();
    assert.equal(workers[0]!.jobs[1]!.uri, 'C');
    const result = {} as AnalysisResult;
    workers[0]!.jobs[1]!.resolve(result);
    workers[1]!.jobs[0]!.resolve(result);
    assert.equal(await b, result);
    assert.equal(await c, result);
    pool.dispose();
});

test('shutdown rejects queued and in-flight requests and terminates each worker once', async () => {
    const workers = [new ControlledExecutor(), new ControlledExecutor()];
    const pool = new WorkerPoolAnalysisExecutor(2, i => workers[i]!);
    const a = pool.execute(input('A'));
    const b = pool.execute(input('B'));
    const c = pool.execute(input('C'));
    pool.dispose();
    await assert.rejects(a, /shut down/);
    await assert.rejects(b, /shut down/);
    await assert.rejects(c, /shut down/);
    await assert.rejects(pool.execute(input('D')), /disposed/);
    pool.dispose();
    assert.deepEqual(workers.map(w => w.disposed), [1, 1]);
});

test('partial pool construction disposes previously created workers', () => {
    const first = new ControlledExecutor();
    assert.throws(() => new WorkerPoolAnalysisExecutor(2, index => {
        if (index === 1) throw new Error('creation failed');
        return first;
    }), /creation failed/);
    assert.equal(first.disposed, 1);
    assert.throws(() => new WorkerPoolAnalysisExecutor(0, () => first), /positive integer/);
});

test('real workers reconstruct independent results from parallel requests', { timeout: 30000 }, async () => {
    const samples: { index: number; metrics: WorkerAnalysisMetrics }[] = [];
    const workerFile = path.join(__dirname, 'fixtures/analysisWorkerBootstrap.cjs');
    const pool = new WorkerPoolAnalysisExecutor(2, index => new WorkerAnalysisExecutor(
        workerFile, { onMetrics: metrics => samples.push({ index, metrics }) }
    ));
    try {
        const [a, b] = await Promise.all([
            pool.execute(input('file:///pool/A.P')),
            pool.execute(input('file:///pool/B.P'))
        ]);
        assert.equal(a.rootAnalysis.source.uri, 'file:///pool/A.P');
        assert.equal(b.rootAnalysis.source.uri, 'file:///pool/B.P');
        assert.equal(typeof a.rootAnalysis.ast.lookupSourceValue, 'function');
        assert.equal(typeof b.rootAnalysis.ast.lookupSourceValue, 'function');
        assert.deepEqual(samples.map(s => s.index).sort(), [0, 1]);
        assert.ok(samples.every(s => s.metrics.totalMs >= s.metrics.analyzeMs));
    } finally {
        pool.dispose();
    }
});

test('parallel scheduling does not commit an invalidated result or overlap its root', async () => {
    const workers = [new ControlledExecutor(), new ControlledExecutor()];
    const pool = new WorkerPoolAnalysisExecutor(2, index => workers[index]!);
    const current = new Map([['A', 1], ['B', 1]]);
    const commits: string[] = [];
    const activity: boolean[] = [];
    const errors: unknown[] = [];
    const scheduler = new AnalysisScheduler(async request => {
        const result = await pool.execute(input(request.rootUri));
        if (current.get(request.rootUri) === request.requestId) {
            assert.ok(result);
            commits.push(`${request.rootUri}:${request.requestId}`);
        }
    }, request => current.get(request.rootUri) === request.requestId,
    error => errors.push(error), undefined, active => activity.push(active), 2);
    async function until(predicate: () => boolean): Promise<void> {
        for (let attempt = 0; attempt < 100; attempt++) {
            if (predicate()) return;
            await new Promise<void>(resolve => setImmediate(resolve));
        }
        assert.fail('scheduled analysis never reached expected state');
    }
    const request = (rootUri: string, requestId: number) => ({
        rootUri, requestId, trigger: 'test', priority: 'background' as const
    });
    try {
        scheduler.enqueue(request('A', 1));
        scheduler.enqueue(request('B', 1));
        await until(() => workers.every(worker => worker.jobs.length === 1));
        current.set('A', 2);
        scheduler.enqueue(request('A', 2));
        workers[1]!.jobs[0]!.resolve({} as AnalysisResult);
        await until(() => commits.includes('B:1'));
        // Although a worker is idle, A2 cannot run while A1 is in flight.
        assert.equal(workers[1]!.jobs.length, 1);
        workers[0]!.jobs[0]!.resolve({} as AnalysisResult);
        await until(() => workers.some(worker => worker.jobs.length > 1));
        assert.deepEqual(commits, ['B:1']);
        const retry = workers.flatMap(worker => worker.jobs.slice(1));
        assert.equal(retry.length, 1);
        assert.equal(retry[0]!.uri, 'A');
        retry[0]!.resolve({} as AnalysisResult);
        await until(() => activity.includes(false));
        assert.deepEqual(commits, ['B:1', 'A:2']);
        assert.deepEqual(activity, [true, false]);
        assert.deepEqual(errors, []);
    } finally {
        scheduler.dispose();
        pool.dispose();
    }
});

test('four-worker pool fills exactly four slots and reuses freed slots', async () => {
    const workers = Array.from({ length: 4 }, () => new ControlledExecutor());
    const pool = new WorkerPoolAnalysisExecutor(4, index => workers[index]!);
    try {
        const requests = ['A', 'B', 'C', 'D', 'E', 'F'].map(uri => pool.execute(input(uri)));
        assert.deepEqual(workers.map(w => w.jobs.map(j => j.uri)),
            [['A'], ['B'], ['C'], ['D']]);

        const result = {} as AnalysisResult;
        workers[3]!.jobs[0]!.resolve(result);
        assert.equal(await requests[3], result);
        await flush();
        assert.deepEqual(workers[3]!.jobs.map(j => j.uri), ['D', 'E']);

        workers[1]!.jobs[0]!.reject(new Error('B failed'));
        await assert.rejects(requests[1]!, /B failed/);
        await flush();
        assert.deepEqual(workers[1]!.jobs.map(j => j.uri), ['B', 'F']);

        for (const index of [0, 2]) workers[index]!.jobs[0]!.resolve(result);
        workers[3]!.jobs[1]!.resolve(result);
        workers[1]!.jobs[1]!.resolve(result);
        const results = await Promise.all([
            requests[0], requests[2], requests[4], requests[5]
        ]);
        assert.ok(results.every(value => value === result));
    } finally {
        pool.dispose();
    }
    assert.deepEqual(workers.map(w => w.disposed), [1, 1, 1, 1]);
});

test('four-worker shutdown rejects all running and pending requests', async () => {
    const workers = Array.from({ length: 4 }, () => new ControlledExecutor());
    const pool = new WorkerPoolAnalysisExecutor(4, index => workers[index]!);
    const requests = ['A', 'B', 'C', 'D', 'E'].map(uri => pool.execute(input(uri)));
    assert.deepEqual(workers.map(w => w.jobs.length), [1, 1, 1, 1]);
    pool.dispose();
    const outcomes = await Promise.allSettled(requests);
    assert.ok(outcomes.every(outcome => outcome.status === 'rejected'
        && /shut down/.test(String(outcome.reason))));
    assert.deepEqual(workers.map(w => w.disposed), [1, 1, 1, 1]);
});

test('four actual worker threads reconstruct four independent results', { timeout: 60000 }, async () => {
    const seen: { index: number; metrics: WorkerAnalysisMetrics }[] = [];
    const bootstrap = path.join(__dirname, 'fixtures/analysisWorkerBootstrap.cjs');
    const pool = new WorkerPoolAnalysisExecutor(4, index => new WorkerAnalysisExecutor(
        bootstrap, { onMetrics: metrics => seen.push({ index, metrics }) }
    ));
    try {
        const uris = Array.from({ length: 4 }, (_, index) => `file:///pool/four-${index + 1}.P`);
        const results = await Promise.all(uris.map(uri => pool.execute(input(uri))));
        assert.deepEqual(results.map(result => result.rootAnalysis.source.uri), uris);
        assert.ok(results.every(result =>
            typeof result.rootAnalysis.ast.lookupSourceValue === 'function'));
        assert.deepEqual(seen.map(sample => sample.index).sort(), [0, 1, 2, 3]);
        assert.ok(seen.every(sample => sample.metrics.totalMs >= sample.metrics.analyzeMs));
    } finally {
        pool.dispose();
    }
});

test('eight-worker pool limits work to eight active slots and reuses released slots', async () => {
    const workers = Array.from({ length: 8 }, () => new ControlledExecutor());
    const pool = new WorkerPoolAnalysisExecutor(8, index => workers[index]!);
    try {
        const uris = Array.from({ length: 11 }, (_, index) => `ROOT_${index + 1}`);
        const requests = uris.map(uri => pool.execute(input(uri)));
        assert.deepEqual(workers.map(worker => worker.jobs.map(job => job.uri)),
            uris.slice(0, 8).map(uri => [uri]));

        const result = {} as AnalysisResult;
        workers[7]!.jobs[0]!.resolve(result);
        assert.equal(await requests[7], result);
        await flush();
        assert.deepEqual(workers[7]!.jobs.map(job => job.uri), ['ROOT_8', 'ROOT_9']);

        workers[2]!.jobs[0]!.reject(new Error('root three failed'));
        await assert.rejects(requests[2]!, /root three failed/);
        await flush();
        assert.deepEqual(workers[2]!.jobs.map(job => job.uri), ['ROOT_3', 'ROOT_10']);

        workers[0]!.jobs[0]!.resolve(result);
        assert.equal(await requests[0], result);
        await flush();
        assert.deepEqual(workers[0]!.jobs.map(job => job.uri), ['ROOT_1', 'ROOT_11']);

        for (const worker of workers) {
            for (const job of worker.jobs.slice(worker.jobs.length === 2 ? 1 : 0)) {
                job.resolve(result);
            }
        }
        const outcomes = await Promise.allSettled(requests);
        assert.equal(outcomes.filter(outcome => outcome.status === 'rejected').length, 1);
        assert.ok(outcomes.every(outcome => outcome.status === 'rejected' || outcome.value === result));
    } finally {
        pool.dispose();
    }
    assert.deepEqual(workers.map(worker => worker.disposed), Array(8).fill(1));
});

test('eight-worker shutdown rejects all eight in-flight and queued requests', async () => {
    const workers = Array.from({ length: 8 }, () => new ControlledExecutor());
    const pool = new WorkerPoolAnalysisExecutor(8, index => workers[index]!);
    const requests = Array.from({ length: 10 }, (_, index) =>
        pool.execute(input(`ROOT_${index + 1}`)));
    assert.deepEqual(workers.map(worker => worker.jobs.length), Array(8).fill(1));
    pool.dispose();
    const outcomes = await Promise.allSettled(requests);
    assert.ok(outcomes.every(outcome => outcome.status === 'rejected'
        && /shut down/.test(String(outcome.reason))));
    assert.deepEqual(workers.map(worker => worker.disposed), Array(8).fill(1));
});

test('eight real worker threads return independent reconstructable analyses',
    { timeout: 120000 }, async () => {
        const seen: { index: number; metrics: WorkerAnalysisMetrics }[] = [];
        const bootstrap = path.join(__dirname, 'fixtures/analysisWorkerBootstrap.cjs');
        const pool = new WorkerPoolAnalysisExecutor(8, index => new WorkerAnalysisExecutor(
            bootstrap, { onMetrics: metrics => seen.push({ index, metrics }) }
        ));
        try {
            const uris = Array.from({ length: 8 }, (_, index) =>
                `file:///pool/eight-${index + 1}.P`);
            const results = await Promise.all(uris.map(uri => pool.execute(input(uri))));
            assert.deepEqual(results.map(result => result.rootAnalysis.source.uri), uris);
            assert.ok(results.every(result =>
                typeof result.rootAnalysis.ast.lookupSourceValue === 'function'));
            assert.deepEqual(seen.map(sample => sample.index).sort((a, b) => a - b),
                [0, 1, 2, 3, 4, 5, 6, 7]);
            assert.ok(seen.every(sample => sample.metrics.totalMs >= sample.metrics.analyzeMs));
        } finally {
            pool.dispose();
        }
    });
