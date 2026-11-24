// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { AnalysisResult } from '../../validation/analysisResult';
import type { PearlSettings } from '../../settings/pearlSettings';
import { LocalAnalysisExecutor } from '../localAnalysisExecutor';
import type { AnalysisExecutionInput } from '../analysisExecutor';

const settings: PearlSettings = {
    maxNumberOfProblems: 100,
    warnOnCharTruncation: true,
    traceServer: 'off',
    workingDirMode: 'file',
    macros: { MODE: '42' }
};

function input(version: number, text: string): AnalysisExecutionInput {
    return {
        source: { uri: 'file:///test/ROOT.P', languageId: 'pearl', version, text },
        settings
    };
}

test('local executor passes an exact root snapshot and settings to the analyzer', async () => {
    const expected = {} as AnalysisResult;
    let calls = 0;
    const executor = new LocalAnalysisExecutor(async (document, receivedSettings) => {
        calls++;
        assert.equal(document.uri, 'file:///test/ROOT.P');
        assert.equal(document.languageId, 'pearl');
        assert.equal(document.version, 7);
        assert.equal(document.getText(), 'PROBLEM;');
        assert.strictEqual(receivedSettings, settings);
        return expected;
    });

    const result = await executor.execute(input(7, 'PROBLEM;'));
    assert.strictEqual(result, expected);
    assert.equal(calls, 1);
});

test('each execution uses its own source version and text', async () => {
    const seen: { version: number; text: string }[] = [];
    const executor = new LocalAnalysisExecutor(async document => {
        seen.push({ version: document.version, text: document.getText() });
        return {} as AnalysisResult;
    });
    await executor.execute(input(1, 'FIRST'));
    await executor.execute(input(2, 'SECOND'));
    assert.deepEqual(seen, [
        { version: 1, text: 'FIRST' },
        { version: 2, text: 'SECOND' }
    ]);
});

test('local executor begins synchronous validator work before yielding', async () => {
    const calls: string[] = [];
    const executor = new LocalAnalysisExecutor(async () => {
        calls.push('validator');
        return {} as AnalysisResult;
    });
    calls.push('before');
    const promise = executor.execute(input(1, 'FIRST'));
    calls.push('after');
    assert.deepEqual(calls, ['before', 'validator', 'after']);
    await promise;
});

test('executor propagates asynchronous analyzer failures to its caller', async () => {
    const expected = new Error('validator failure');
    const executor = new LocalAnalysisExecutor(async () => {
        throw expected;
    });
    await assert.rejects(executor.execute(input(1, 'FIRST')), error => error === expected);
});

test('executor does not mutate the supplied input', async () => {
    const source = Object.freeze({
        uri: 'file:///test/ROOT.P', languageId: 'pearl', version: 1, text: 'FIRST'
    });
    const frozenSettings = Object.freeze({
        ...settings,
        macros: Object.freeze({ ...settings.macros })
    });
    const frozenInput = Object.freeze({ source, settings: frozenSettings });
    const executor = new LocalAnalysisExecutor(async document => {
        assert.equal(document.getText(), 'FIRST');
        return {} as AnalysisResult;
    });
    await executor.execute(frozenInput);
    assert.equal(source.text, 'FIRST');
    assert.equal(frozenSettings.macros.MODE, '42');
});
