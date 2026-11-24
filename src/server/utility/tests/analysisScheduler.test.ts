// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
    AnalysisScheduler,
    type AnalysisRequest,
    type AnalysisSchedulerTiming,
    type ScheduledAnalysisTask
} from '../analysisScheduler';

class ManualTiming implements AnalysisSchedulerTiming {
    private time = 0;
    private serial = 0;
    private tasks: { at: number; order: number; cancelled: boolean; fire: () => void }[] = [];

    now(): number { return this.time; }

    delay(fire: () => void, delayMs: number): ScheduledAnalysisTask {
        return this.schedule(fire, delayMs);
    }

    defer(fire: () => void): ScheduledAnalysisTask {
        return this.schedule(fire, 0);
    }

    private schedule(fire: () => void, delayMs: number): ScheduledAnalysisTask {
        const task = { at: this.time + delayMs, order: ++this.serial, cancelled: false, fire };
        this.tasks.push(task);
        return { cancel: () => { task.cancelled = true; } };
    }

    async advanceTo(target: number): Promise<void> {
        assert.ok(target >= this.time);
        for (let count = 0; count < 1000; count++) {
            const candidates = this.tasks.filter(task => !task.cancelled && task.at <= target)
                .sort((a, b) => a.at - b.at || a.order - b.order);
            const next = candidates[0];
            if (!next) {
                this.time = target;
                await this.settle();
                // Promise continuations might have queued another immediate.
                if (!this.tasks.some(task => !task.cancelled && task.at <= target)) return;
                continue;
            }
            this.tasks.splice(this.tasks.indexOf(next), 1);
            this.time = next.at;
            next.fire();
            await this.settle();
        }
        assert.fail('scheduler did not quiesce');
    }

    async drain(): Promise<void> {
        for (let count = 0; count < 1000; count++) {
            const due = this.tasks.filter(task => !task.cancelled)
                .sort((a, b) => a.at - b.at || a.order - b.order)[0];
            if (!due) {
                await this.settle();
                if (!this.tasks.some(task => !task.cancelled)) return;
                continue;
            }
            await this.advanceTo(due.at);
        }
        assert.fail('scheduler did not drain');
    }

    private async settle(): Promise<void> {
        for (let i = 0; i < 8; i++) await Promise.resolve();
    }
}

function request(rootUri: string, requestId: number,
    priority: AnalysisRequest['priority'] = 'background'): AnalysisRequest {
    return { rootUri, requestId, trigger: 'test', priority };
}

function fixture() {
    const timing = new ManualTiming();
    const current = new Map<string, number>();
    const seen: AnalysisRequest[] = [];
    const failures: unknown[] = [];
    const scheduler = new AnalysisScheduler(
        async job => { seen.push(job); },
        job => current.get(job.rootUri) === job.requestId,
        error => { failures.push(error); }, timing
    );
    const enqueue = (job: AnalysisRequest, delayMs = 0) => {
        current.set(job.rootUri, job.requestId);
        return scheduler.enqueue(job, delayMs);
    };
    return { timing, current, seen, failures, scheduler, enqueue };
}

test('many changes of one unit are coalesced into its newest request', async () => {
    const f = fixture();
    assert.equal(f.enqueue(request('A', 1)).replaced, false);
    assert.equal(f.enqueue(request('A', 2)).replaced, true);
    assert.equal(f.enqueue(request('A', 3)).pendingCount, 1);
    await f.timing.drain();
    assert.deepEqual(f.seen.map(job => job.requestId), [3]);
});

test('interactive work runs before earlier background units', async () => {
    const f = fixture();
    f.enqueue(request('A', 1));
    f.enqueue(request('B', 1));
    f.enqueue(request('C', 1, 'interactive'));
    await f.timing.drain();
    assert.deepEqual(f.seen.map(job => job.rootUri), ['C', 'A', 'B']);
});

test('typing uses trailing-edge debounce and never starts from a stale intermediate buffer', async () => {
    const f = fixture();
    f.enqueue(request('A', 1, 'interactive'), 200);
    await f.timing.advanceTo(100);
    assert.equal(f.seen.length, 0);
    f.enqueue(request('A', 2, 'interactive'), 200);
    await f.timing.advanceTo(201);
    assert.equal(f.seen.length, 0);
    await f.timing.advanceTo(300);
    assert.deepEqual(f.seen.map(job => job.requestId), [2]);
});

test('a pending interactive change prevents a long background job from starting', async () => {
    const f = fixture();
    f.enqueue(request('A', 1));
    f.enqueue(request('B', 1, 'interactive'), 200);
    await f.timing.advanceTo(199);
    assert.equal(f.seen.length, 0);
    await f.timing.advanceTo(200);
    assert.deepEqual(f.seen.map(job => job.rootUri), ['B', 'A']);
});

test('a background update does not downgrade pending interactive priority', async () => {
    const f = fixture();
    f.enqueue(request('A', 1, 'interactive'), 200);
    f.enqueue(request('B', 1));
    f.enqueue(request('A', 2));
    await f.timing.advanceTo(199);
    assert.deepEqual(f.seen, []);
    await f.timing.drain();
    assert.deepEqual(f.seen.map(job => `${job.rootUri}:${job.requestId}`), ['A:2', 'B:1']);
    assert.equal(f.seen[0]?.priority, 'interactive');
});

test('DocumentRegistry-style request invalidation suppresses stale queued work', async () => {
    const f = fixture();
    f.enqueue(request('A', 1));
    f.current.set('A', 2); // invalidated, without scheduling a replacement
    await f.timing.drain();
    assert.equal(f.seen.length, 0);
});

test('closing a root cancels pending work', async () => {
    const f = fixture();
    f.enqueue(request('A', 1));
    f.enqueue(request('B', 1));
    f.scheduler.cancel('A');
    await f.timing.drain();
    assert.deepEqual(f.seen.map(job => job.rootUri), ['B']);
});

test('a superseding request queued while one runs executes afterwards', async () => {
    const timing = new ManualTiming();
    const current = new Map([['A', 1]]);
    const seen: number[] = [];
    let finish!: () => void;
    const held = new Promise<void>(resolve => { finish = resolve; });
    const scheduler = new AnalysisScheduler(
        async job => {
            seen.push(job.requestId);
            if (job.requestId === 1) await held;
        },
        job => current.get(job.rootUri) === job.requestId,
        () => assert.fail('unexpected error'), timing
    );
    scheduler.enqueue(request('A', 1));
    await timing.advanceTo(0);
    assert.deepEqual(seen, [1]);
    current.set('A', 2);
    scheduler.enqueue(request('A', 2));
    current.set('A', 3);
    scheduler.enqueue(request('A', 3));
    await timing.advanceTo(0);
    assert.deepEqual(seen, [1]);
    finish();
    await timing.drain();
    assert.deepEqual(seen, [1, 3]);
});

test('an executor error is isolated; subsequent roots still run', async () => {
    const timing = new ManualTiming();
    const seen: string[] = [];
    const errors: unknown[] = [];
    const scheduler = new AnalysisScheduler(
        async job => {
            seen.push(job.rootUri);
            if (job.rootUri === 'A') throw new Error('broken analysis');
        },
        () => true,
        error => { errors.push(error); }, timing
    );
    scheduler.enqueue(request('A', 1));
    scheduler.enqueue(request('B', 1));
    await timing.drain();
    assert.deepEqual(seen, ['A', 'B']);
    assert.equal(errors.length, 1);
});

test('dispose prevents pending work and later enqueue operations', async () => {
    const f = fixture();
    f.enqueue(request('A', 1));
    f.scheduler.dispose();
    f.enqueue(request('B', 1));
    await f.timing.drain();
    assert.equal(f.seen.length, 0);
});


test('activity notification spans the entire batch, including an awaited worker job', async () => {
    const timing = new ManualTiming();
    const states: boolean[] = [];
    let finish!: () => void;
    const held = new Promise<void>(resolve => { finish = resolve; });
    const seen: string[] = [];
    const scheduler = new AnalysisScheduler(
        async job => {
            seen.push(job.rootUri);
            if (job.rootUri === 'A') await held;
        },
        () => true,
        () => assert.fail('unexpected error'),
        timing,
        active => states.push(active)
    );
    scheduler.enqueue(request('A', 1));
    scheduler.enqueue(request('B', 1));
    assert.deepEqual(states, [true]);
    await timing.advanceTo(0);
    assert.deepEqual(seen, ['A']);
    assert.deepEqual(states, [true]);
    finish();
    await timing.drain();
    assert.deepEqual(seen, ['A', 'B']);
    assert.deepEqual(states, [true, false]);
});

test('cancellation and rejected stale work end the batch exactly once', async () => {
    const timing = new ManualTiming();
    const states: boolean[] = [];
    const scheduler = new AnalysisScheduler(
        async () => assert.fail('stale analysis must not run'),
        () => false,
        () => assert.fail('unexpected error'),
        timing,
        active => states.push(active)
    );
    scheduler.enqueue(request('A', 1));
    scheduler.enqueue(request('B', 1));
    scheduler.cancel('B');
    assert.deepEqual(states, [true]);
    await timing.drain();
    assert.deepEqual(states, [true, false]);
});

test('two slots start separate roots concurrently but never overlap the same root', async () => {
    const timing = new ManualTiming();
    const current = new Map([['A', 1], ['B', 1], ['C', 1]]);
    const seen: string[] = [];
    const finish = new Map<string, () => void>();
    const states: boolean[] = [];
    const scheduler = new AnalysisScheduler(async job => {
        seen.push(`${job.rootUri}:${job.requestId}`);
        await new Promise<void>(resolve => finish.set(`${job.rootUri}:${job.requestId}`, resolve));
    }, job => current.get(job.rootUri) === job.requestId,
    () => assert.fail('unexpected error'), timing, active => states.push(active), 2);
    scheduler.enqueue(request('A', 1));
    scheduler.enqueue(request('B', 1));
    scheduler.enqueue(request('C', 1));
    await timing.advanceTo(0);
    assert.deepEqual(seen, ['A:1', 'B:1']);
    assert.deepEqual(states, [true]);

    // A2 supersedes A1 but must not start until A1 has completed.
    current.set('A', 2);
    scheduler.enqueue(request('A', 2, 'interactive'));
    await timing.advanceTo(0);
    assert.deepEqual(seen, ['A:1', 'B:1']);
    finish.get('B:1')!();
    await timing.advanceTo(0);
    // A2 is blocked by A1, but background C may use the free slot.
    assert.deepEqual(seen, ['A:1', 'B:1', 'C:1']);
    finish.get('A:1')!();
    await timing.advanceTo(0);
    assert.deepEqual(seen, ['A:1', 'B:1', 'C:1', 'A:2']);
    finish.get('C:1')!();
    finish.get('A:2')!();
    await timing.drain();
    assert.deepEqual(states, [true, false]);
});

test('two worker slots preserve interactive priority among runnable roots', async () => {
    const timing = new ManualTiming();
    const seen: string[] = [];
    let finishFirst!: () => void;
    let finishSecond!: () => void;
    const first = new Promise<void>(resolve => { finishFirst = resolve; });
    const second = new Promise<void>(resolve => { finishSecond = resolve; });
    const scheduler = new AnalysisScheduler(async job => {
        seen.push(job.rootUri);
        if (job.rootUri === 'A') await first;
        if (job.rootUri === 'D') await second;
    }, () => true, () => assert.fail('unexpected error'), timing, undefined, 2);
    scheduler.enqueue(request('A', 1));
    scheduler.enqueue(request('B', 1));
    scheduler.enqueue(request('C', 1));
    scheduler.enqueue(request('D', 1, 'interactive'));
    await timing.advanceTo(0);
    assert.deepEqual(seen, ['D', 'A']);
    finishSecond();
    await timing.advanceTo(0);
    // B finishes immediately, so its newly free slot may start C too.
    assert.deepEqual(seen, ['D', 'A', 'B', 'C']);
    finishFirst();
    await timing.drain();
    assert.deepEqual(seen, ['D', 'A', 'B', 'C']);
});

test('invalid scheduler concurrency limits fail early', () => {
    for (const limit of [0, -1, 1.5, NaN]) {
        assert.throws(() => new AnalysisScheduler(async () => undefined, () => true, () => {},
            undefined, undefined, limit), /positive integer/);
    }
});
