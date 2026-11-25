// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { AnalysisResult } from '../../validation/analysisResult';
import type { AnalysisIncludeSourceSnapshotSet, AnalysisSourceSnapshot } from '../analysisSourceSnapshot';
import { LocalAnalysisExecutor } from '../localAnalysisExecutor';
import { SnapshotIncludeSourceResolver } from '../snapshotIncludeSourceResolver';
import type { PearlSettings } from '../../settings/pearlSettings';

const root: AnalysisSourceSnapshot = {
    uri: 'file:///project/main.P', languageId: 'pearl', version: 7,
    text: '#include "Outer.h"\n'
};
const outer: AnalysisSourceSnapshot = {
    uri: 'file:///project/Outer.h', languageId: 'pearl', version: 3,
    text: '#include "Nested.h"\n'
};
const nested: AnalysisSourceSnapshot = {
    uri: 'file:///project/Nested.h', languageId: 'pearl', version: 11,
    text: 'TYPE Nested FIXED;'
};
const missing = 'file:///project/Missing.h';

function captured(): AnalysisIncludeSourceSnapshotSet {
    return {
        sources: [outer, nested],
        resolutions: [
            { includingUri: root.uri, includePath: 'Outer.h', targetUri: outer.uri, found: true },
            { includingUri: outer.uri, includePath: 'Nested.h', targetUri: nested.uri, found: true },
            { includingUri: root.uri, includePath: 'Missing.h', targetUri: missing, found: false }
        ]
    };
}

test('replays nested lookups relative to their including physical URI', () => {
    const r = new SnapshotIncludeSourceResolver(root, captured());
    assert.equal(r.resolveInclude(root.uri, 'Outer.h')?.getText(), outer.text);
    assert.equal(r.resolveInclude(outer.uri, 'Nested.h')?.getText(), nested.text);
    assert.equal(r.resolveIncludeUri(outer.uri, 'Nested.h'), nested.uri);
    assert.equal(r.resolveInclude(root.uri, 'Missing.h'), null);
    assert.equal(r.resolveIncludeUri(root.uri, 'Missing.h'), missing);
});

test('repeated include lookups use the same frozen physical text', () => {
    const mutable = { ...outer };
    const capture = { ...captured(), sources: [mutable, nested] };
    const r = new SnapshotIncludeSourceResolver(root, capture);
    mutable.text = 'changed in editor after capture';
    assert.equal(r.resolveInclude(root.uri, 'Outer.h')?.getText(), outer.text);
    assert.equal(r.resolveInclude(root.uri, 'Outer.h')?.getText(), outer.text);
});

test('uncaptured include requests fail closed instead of pretending a file is missing', () => {
    const r = new SnapshotIncludeSourceResolver(root, captured());
    assert.throws(() => r.resolveInclude(root.uri, 'New.h'), /Uncaptured include lookup/);
    assert.throws(() => r.resolveIncludeUri(outer.uri, 'Other.h'), /Uncaptured include lookup/);
});

test('incomplete and internally inconsistent snapshots are rejected', () => {
    assert.throws(() => new SnapshotIncludeSourceResolver(root, {
        sources: [], resolutions: captured().resolutions
    }), /Include target not captured/);
    assert.throws(() => new SnapshotIncludeSourceResolver(root, {
        sources: [outer, { ...outer, text: 'conflict' }], resolutions: []
    }), /Conflicting source snapshots/);
    assert.throws(() => new SnapshotIncludeSourceResolver(root, {
        sources: [outer], resolutions: [{
            includingUri: 'file:///unknown.h', includePath: 'Outer.h',
            targetUri: outer.uri, found: true
        }]
    }), /uncaptured source/);
    assert.throws(() => new SnapshotIncludeSourceResolver(root, {
        sources: [outer], resolutions: [
            { includingUri: root.uri, includePath: 'Outer.h', targetUri: outer.uri, found: true },
            { includingUri: root.uri, includePath: 'Outer.h', targetUri: missing, found: false }
        ]
    }), /Conflicting include lookup/);
});

const settings: PearlSettings = {
    maxNumberOfProblems: 100, warnOnCharTruncation: true,
    traceServer: 'off', macros: {}
};

test('local executor passes frozen include access only when a capture is supplied', async () => {
    let calls = 0;
    const executor = new LocalAnalysisExecutor(async (_document, _settings, resolver) => {
        calls++;
        if (calls === 1) {
            assert.equal(resolver, undefined);
        } else {
            assert.equal(resolver?.resolveInclude(root.uri, 'Outer.h')?.getText(), outer.text);
            assert.equal(resolver?.resolveInclude(root.uri, 'Missing.h'), null);
        }
        return {} as AnalysisResult;
    });
    await executor.execute({ source: root, settings });
    await executor.execute({ source: root, settings, includeSnapshots: captured() });
    assert.equal(calls, 2);
});
