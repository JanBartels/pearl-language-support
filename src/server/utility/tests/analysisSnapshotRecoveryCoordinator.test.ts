// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { AnalysisSnapshotRecoveryCoordinator, type SnapshotRecoveryRegistry } from '../analysisSnapshotRecoveryCoordinator';
import { AnalysisScheduler, type AnalysisRequest, type AnalysisSchedulerTiming,
    type ScheduledAnalysisTask } from '../analysisScheduler';

const include = 'file:///project/shared.inc';

class Registry implements SnapshotRecoveryRegistry {
    readonly versions = new Map<string, number>();
    readonly owners = new Map<string, string[]>();
    readonly invalidations: string[] = [];
    readonly cleared: string[] = [];

    begin(root: string): number {
        const next = (this.versions.get(root) ?? 0) + 1;
        this.versions.set(root, next);
        return next;
    }
    isCurrentAnalysis(root: string, requestId: number): boolean {
        return this.versions.get(root) === requestId;
    }
    invalidateUri(uri: string): string[] {
        this.invalidations.push(uri);
        const roots = this.owners.get(uri) ?? [];
        for (const root of roots) {
            this.clearAnalysisResult(root);
            this.begin(root);
        }
        return [...roots];
    }
    clearAnalysisResult(root: string): void {
        this.cleared.push(root);
    }
}

function fixture() {
    const registry = new Registry();
    const queued: string[] = [];
    const coordinator = new AnalysisSnapshotRecoveryCoordinator(registry, uri => {
        queued.push(uri);
        registry.begin(uri);
    });
    return { registry, queued, coordinator };
}

test('late stale roots do not invalidate already scheduled owners after an include event', () => {
    const f = fixture();
    f.registry.owners.set(include, ['A', 'B']);
    const inFlight = f.registry.begin('C'); // C has no committed include edge yet
    const captured = f.coordinator.captureGeneration();
    f.coordinator.noteSourceInvalidation(include);
    assert.deepEqual(f.registry.invalidateUri(include), ['A', 'B']);
    f.registry.begin('A'); // new, debounced analysis request
    f.registry.begin('B');
    const aRequest = f.registry.versions.get('A');
    const bRequest = f.registry.versions.get('B');
    const decision = f.coordinator.recover('C', inFlight, captured, [include]);

    assert.deepEqual(decision.handledSources, [include]);
    assert.deepEqual(decision.invalidatedSources, []);
    assert.deepEqual(decision.queuedRoots, ['C']);
    assert.deepEqual(f.registry.invalidations, [include]);
    assert.deepEqual(f.queued, ['C']);
    assert.equal(f.registry.versions.get('A'), aRequest);
    assert.equal(f.registry.versions.get('B'), bRequest);
});

test('four stale workers recover independently without restarting committed include owners', () => {
    const f = fixture();
    f.registry.owners.set(include, ['committed']);
    const requests = ['A', 'B', 'C', 'D'].map(root => ({ root, requestId: f.registry.begin(root) }));
    const captured = f.coordinator.captureGeneration();
    f.coordinator.noteSourceInvalidation(include);
    f.registry.invalidateUri(include);
    f.registry.begin('committed'); // event already queued a newer request

    for (const { root, requestId } of requests) {
        const decision = f.coordinator.recover(root, requestId, captured, [include]);
        assert.deepEqual(decision.queuedRoots, [root]);
        assert.deepEqual(decision.invalidatedSources, []);
    }
    assert.deepEqual(f.queued, ['A', 'B', 'C', 'D']);
    assert.deepEqual(f.registry.invalidations, [include]);
});

test('an obsolete worker cannot invalidate or supersede its newer pending request', () => {
    const f = fixture();
    const old = f.registry.begin('A');
    const captured = f.coordinator.captureGeneration();
    f.coordinator.noteSourceInvalidation(include);
    f.registry.begin('A'); // the newer request already covers this source edit
    const decision = f.coordinator.recover('A', old, captured, [include]);
    assert.equal(decision.skipped, true);
    assert.deepEqual(f.registry.invalidations, []);
    assert.deepEqual(f.queued, []);
});

test('previously unreported source changes still invalidate all committed owners', () => {
    const f = fixture();
    f.registry.owners.set(include, ['A', 'B']);
    const current = f.registry.begin('C');
    const captured = f.coordinator.captureGeneration();
    const decision = f.coordinator.recover('C', current, captured, [include, include]);
    assert.deepEqual(decision.invalidatedSources, [include]);
    assert.deepEqual(decision.handledSources, []);
    assert.deepEqual(decision.queuedRoots, ['A', 'B', 'C']);
    assert.deepEqual(f.registry.invalidations, [include]);
    assert.deepEqual(f.queued, ['A', 'B', 'C']);
});

test('one recovered disk change cannot repeatedly reset other root requests', () => {
    const f = fixture();
    f.registry.owners.set(include, ['committed']);
    const oldA = f.registry.begin('A');
    const oldB = f.registry.begin('B');
    const captured = f.coordinator.captureGeneration();
    const first = f.coordinator.recover('A', oldA, captured, [include]);
    const second = f.coordinator.recover('B', oldB, captured, [include]);
    assert.deepEqual(first.queuedRoots, ['committed', 'A']);
    assert.deepEqual(second.queuedRoots, ['B']);
    assert.deepEqual(f.registry.invalidations, [include]);
});

test('an event before capture does not cover a later unreported change', () => {
    const f = fixture();
    f.coordinator.noteSourceInvalidation(include);
    const captured = f.coordinator.captureGeneration();
    const requestId = f.registry.begin('A');
    const decision = f.coordinator.recover('A', requestId, captured, [include]);
    assert.deepEqual(decision.invalidatedSources, [include]);
});

test('source generations are independent and an observed edit cannot hide a different source change', () => {
    const f = fixture();
    const other = 'file:///project/other.inc';
    f.registry.owners.set(other, ['B']);
    const captured = f.coordinator.captureGeneration();
    f.coordinator.noteSourceInvalidation(include);
    const requestId = f.registry.begin('A');
    const decision = f.coordinator.recover('A', requestId, captured, [include, other]);
    assert.deepEqual(decision.handledSources, [include]);
    assert.deepEqual(decision.invalidatedSources, [other]);
    assert.deepEqual(decision.queuedRoots, ['B', 'A']);
    assert.deepEqual(f.registry.invalidations, [other]);
});

class ManualClock implements AnalysisSchedulerTiming {
    nowMs = 0;
    private tasks: { due: number; cancel: boolean; callback: () => void }[] = [];
    now(): number { return this.nowMs; }
    delay(callback: () => void, ms: number): ScheduledAnalysisTask {
        const task = { due: this.nowMs + ms, cancel: false, callback };
        this.tasks.push(task);
        return { cancel: () => { task.cancel = true; } };
    }
    defer(callback: () => void): ScheduledAnalysisTask { return this.delay(callback, 0); }
    async advanceTo(now: number): Promise<void> {
        for (let n = 0; n < 100; n++) {
            const candidate = this.tasks.filter(t => !t.cancel && t.due <= now)
                .sort((a, b) => a.due - b.due)[0];
            if (!candidate) break;
            this.tasks.splice(this.tasks.indexOf(candidate), 1);
            this.nowMs = candidate.due;
            candidate.callback();
            for (let i = 0; i < 10; i++) await Promise.resolve();
        }
        this.nowMs = now;
    }
}

test('late worker recovery preserves a newer interactive debounce in the real scheduler', async () => {
    const clock = new ManualClock();
    const registry = new Registry();
    const started: AnalysisRequest[] = [];
    const scheduler = new AnalysisScheduler(async request => { started.push(request); },
        request => registry.isCurrentAnalysis(request.rootUri, request.requestId),
        error => assert.fail(String(error)), clock);
    const enqueue = (uri: string, debounceMs = 0) => {
        const requestId = registry.begin(uri);
        scheduler.enqueue({ rootUri: uri, requestId, trigger: 'test', priority: 'interactive' }, debounceMs);
    };
    const coordinator = new AnalysisSnapshotRecoveryCoordinator(registry, uri => enqueue(uri));
    registry.owners.set(include, ['A']);
    const oldWorker = registry.begin('B');
    const captured = coordinator.captureGeneration();
    coordinator.noteSourceInvalidation(include);
    registry.invalidateUri(include);
    enqueue('A', 200);
    await clock.advanceTo(100);
    const decision = coordinator.recover('B', oldWorker, captured, [include]);
    assert.deepEqual(decision.queuedRoots, ['B']);
    await clock.advanceTo(199);
    assert.deepEqual(started.map(r => r.rootUri), ['B']);
    await clock.advanceTo(200);
    assert.deepEqual(started.map(r => r.rootUri), ['B', 'A']);
    scheduler.dispose();
});
