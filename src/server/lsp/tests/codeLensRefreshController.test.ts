// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import test from 'node:test';
import assert from 'node:assert/strict';
import {
    CodeLensRefreshController,
    type CodeLensRefreshScheduler
} from '../codeLensRefreshController';

function manualScheduler() {
    const tasks: { run: () => void; cancelled: boolean }[] = [];
    const schedule: CodeLensRefreshScheduler = callback => {
        const task = { run: callback, cancelled: false };
        tasks.push(task);
        return { cancel: () => { task.cancelled = true; } };
    };
    const flush = () => {
        for (const task of tasks.splice(0)) {
            if (!task.cancelled) task.run();
        }
    };
    return { schedule, flush };
}

async function settlePromises(): Promise<void> {
    for (let i = 0; i < 6; i++) await Promise.resolve();
}

test('no refresh is sent without client support', () => {
    const timer = manualScheduler();
    let requests = 0;
    const controller = new CodeLensRefreshController(
        async () => { requests++; }, () => {}, timer.schedule
    );
    controller.schedule();
    timer.flush();
    assert.equal(requests, 0);
});

test('a burst of committed analyses produces one final refresh', async () => {
    const timer = manualScheduler();
    let requests = 0;
    const controller = new CodeLensRefreshController(
        async () => { requests++; }, () => {}, timer.schedule
    );
    controller.setSupported(true);
    for (let i = 0; i < 19; i++) controller.schedule();
    timer.flush();
    await settlePromises();
    assert.equal(requests, 1);
});

test('an analysis completed during a refresh triggers another after acknowledgement', async () => {
    const timer = manualScheduler();
    let requests = 0;
    let completeFirst!: () => void;
    const firstRequest = new Promise<void>(resolve => { completeFirst = resolve; });
    const controller = new CodeLensRefreshController(
        () => {
            requests++;
            return requests === 1 ? firstRequest : Promise.resolve();
        }, () => {}, timer.schedule
    );
    controller.setSupported(true);
    controller.schedule();
    timer.flush();
    assert.equal(requests, 1);

    // Subsequent translation units finish while the client refreshes.
    controller.schedule();
    controller.schedule();
    timer.flush();
    assert.equal(requests, 1);

    completeFirst();
    await settlePromises();
    timer.flush();
    await settlePromises();
    assert.equal(requests, 2);
});

test('a refresh failure is reported and does not prevent the next refresh', async () => {
    const timer = manualScheduler();
    const failures: unknown[] = [];
    let requests = 0;
    const controller = new CodeLensRefreshController(
        async () => {
            requests++;
            if (requests === 1) throw new Error('client busy');
        }, error => failures.push(error), timer.schedule
    );
    controller.setSupported(true);
    controller.schedule();
    timer.flush();
    await settlePromises();
    controller.schedule();
    timer.flush();
    await settlePromises();
    assert.equal(requests, 2);
    assert.equal(failures.length, 1);
});

test('dispose cancels pending work and prevents a late follow-up', async () => {
    const timer = manualScheduler();
    let requests = 0;
    let complete!: () => void;
    const pending = new Promise<void>(resolve => { complete = resolve; });
    const controller = new CodeLensRefreshController(
        () => { requests++; return pending; }, () => {}, timer.schedule
    );
    controller.setSupported(true);
    controller.schedule();
    timer.flush();
    controller.schedule();
    controller.dispose();
    complete();
    await settlePromises();
    timer.flush();
    assert.equal(requests, 1);
});
