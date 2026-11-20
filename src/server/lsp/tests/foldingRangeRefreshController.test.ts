// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import test from 'node:test';
import assert from 'node:assert/strict';
import {
    FoldingRangeRefreshController,
    type RefreshScheduler
} from '../foldingRangeRefreshController';

function manualScheduler() {
    const tasks: { run: () => void; cancelled: boolean }[] = [];
    const schedule: RefreshScheduler = callback => {
        const task = { run: callback, cancelled: false };
        tasks.push(task);
        return { cancel: () => { task.cancelled = true; } };
    };
    const flush = () => {
        for (const task of tasks.splice(0)) {
            if (!task.cancelled) task.run();
        }
    };
    return { schedule, flush, tasks };
}

test('folding refresh is not requested without client capability', () => {
    const scheduler = manualScheduler();
    let requests = 0;
    const controller = new FoldingRangeRefreshController(
        async () => { requests++; }, () => {}, scheduler.schedule
    );
    controller.schedule();
    scheduler.flush();
    assert.equal(requests, 0);
});

test('multiple refresh triggers are coalesced', () => {
    const scheduler = manualScheduler();
    let requests = 0;
    const controller = new FoldingRangeRefreshController(
        async () => { requests++; }, () => {}, scheduler.schedule
    );
    controller.setSupported(true);
    controller.schedule();
    controller.schedule();
    controller.schedule();
    assert.equal(scheduler.tasks.length, 1);
    scheduler.flush();
    assert.equal(requests, 1);
    controller.schedule();
    scheduler.flush();
    assert.equal(requests, 2);
});

test('disabling capability or disposing cancels a scheduled refresh', () => {
    const scheduler = manualScheduler();
    let requests = 0;
    const controller = new FoldingRangeRefreshController(
        async () => { requests++; }, () => {}, scheduler.schedule
    );
    controller.setSupported(true);
    controller.schedule();
    controller.setSupported(false);
    scheduler.flush();
    assert.equal(requests, 0);
    controller.setSupported(true);
    controller.schedule();
    controller.dispose();
    scheduler.flush();
    assert.equal(requests, 0);
});

test('a rejected folding refresh request is reported', async () => {
    const scheduler = manualScheduler();
    const failures: unknown[] = [];
    const controller = new FoldingRangeRefreshController(
        async () => { throw new Error('not supported'); },
        error => failures.push(error),
        scheduler.schedule
    );
    controller.setSupported(true);
    controller.schedule();
    scheduler.flush();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(failures.length, 1);
    assert.match(String(failures[0]), /not supported/);
});
