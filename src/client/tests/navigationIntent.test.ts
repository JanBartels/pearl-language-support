// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { PendingNavigationIntent, type NavigationIntent } from '../navigationIntent';

const target: NavigationIntent = {
    uri: 'file:///external/lib.ext',
    unitUri: 'file:///project/Main.P',
    occurrenceId: 'nested/first',
    start: { line: 12, character: 4 },
    end: { line: 12, character: 10 }
};

test('definition request alone does not activate a pending context', () => {
    const pending = new PendingNavigationIntent();
    pending.remember(target, 10);
    assert.equal(pending.take('file:///another.h', 12, 4, 11), undefined);
    assert.equal(pending.take(target.uri, 12, 4, 12), target);
    assert.equal(pending.take(target.uri, 12, 4, 13), undefined);
});

test('a target URI without a matching definition position is not navigation', () => {
    const pending = new PendingNavigationIntent();
    pending.remember(target, 10);
    assert.equal(pending.take(target.uri, 22, 0, 11), undefined);
    assert.equal(pending.take(target.uri, 12, 4, 12), target);
});

test('stale Peek or cancellation intents expire instead of changing later tabs', () => {
    const pending = new PendingNavigationIntent(100);
    pending.remember(target, 10);
    assert.equal(pending.take(target.uri, 12, 4, 111), undefined);
});
