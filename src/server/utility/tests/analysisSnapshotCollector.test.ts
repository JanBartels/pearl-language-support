// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { PearlSettings } from '../../settings/pearlSettings';
import type { AnalysisSourceSnapshot } from '../analysisSourceSnapshot';
import {
    AnalysisSnapshotCollector, type SnapshotSourceDocument, type SnapshotSourceProvider
} from '../analysisSnapshotCollector';
import { SnapshotIncludeSourceResolver } from '../snapshotIncludeSourceResolver';
import type { Logger } from '../logging/logger';

const logger: Logger = { info() {}, warn() {}, error() {} };
const settings: PearlSettings = {
    maxNumberOfProblems: 100, warnOnCharTruncation: true,
    traceServer: 'off', macros: {}
};

function source(uri: string, text: string, version = 1): AnalysisSourceSnapshot {
    return { uri, text, version, languageId: 'pearl' };
}

class MemorySources implements SnapshotSourceProvider {
    readonly files = new Map<string, AnalysisSourceSnapshot>();
    readonly lookups: string[] = [];

    constructor(...documents: AnalysisSourceSnapshot[]) {
        for (const document of documents) this.files.set(document.uri, { ...document });
    }

    get(uri: string): SnapshotSourceDocument | null {
        const document = this.files.get(uri);
        return document ? { ...document, getText: () => document.text } : null;
    }

    resolveIncludeUri(uri: string, includePath: string): string {
        return new URL(includePath, uri).href;
    }

    resolveInclude(uri: string, includePath: string): SnapshotSourceDocument | null {
        this.lookups.push(`${uri} -> ${includePath}`);
        return this.get(this.resolveIncludeUri(uri, includePath));
    }
}

test('captures real nested includes, macro paths, missing targets and active branches only', () => {
    const root = source('file:///project/Main.P', `#define Types "outer.h"
#ifdef NEVER
#include "inactive.h"
#endif
#include Types
#include Types
#include "missing.h"
MODULE Main; PROBLEM; MODEND;`);
    const outer = source('file:///project/outer.h', '#include "inner.h"\nTYPE Outer FIXED;\n', 7);
    const inner = source('file:///project/inner.h', 'TYPE Inner FIXED;\n', 4);
    const files = new MemorySources(root, outer, inner);
    const collector = new AnalysisSnapshotCollector(files, logger);
    const capture = collector.collect(root, settings);

    assert.deepEqual(capture.sources.map(item => item.uri).sort(), [outer.uri, inner.uri].sort());
    assert.deepEqual(capture.resolutions.map(item => [item.includingUri, item.includePath, item.found]), [
        [root.uri, 'outer.h', true],
        [outer.uri, 'inner.h', true],
        [root.uri, 'missing.h', false]
    ]);
    assert.ok(!files.lookups.some(item => item.includes('inactive.h')));
    assert.deepEqual(collector.changedSources(root, capture), []);
    const replay = new SnapshotIncludeSourceResolver(root, capture);
    assert.equal(replay.resolveInclude(root.uri, 'outer.h')?.getText(), outer.text);
    assert.equal(replay.resolveInclude(outer.uri, 'inner.h')?.getText(), inner.text);
    assert.equal(replay.resolveInclude(root.uri, 'missing.h'), null);
    assert.equal(replay.resolveIncludeUri(root.uri, 'missing.h'), 'file:///project/missing.h');
});

test('captured texts are frozen independently of later unsaved editor changes', () => {
    const root = source('file:///project/Main.P', '#include "types.h"\n');
    const include = source('file:///project/types.h', 'TYPE A FIXED;', 5);
    const files = new MemorySources(root, include);
    const collector = new AnalysisSnapshotCollector(files, logger);
    const capture = collector.collect(root, settings);
    files.files.set(include.uri, { ...include, version: 6, text: 'TYPE B FLOAT;' });
    const replay = new SnapshotIncludeSourceResolver(root, capture);
    assert.equal(replay.resolveInclude(root.uri, 'types.h')?.getText(), include.text);
    assert.deepEqual(collector.changedSources(root, capture), [include.uri]);
    assert.ok(Object.isFrozen(capture));
    assert.ok(Object.isFrozen(capture.sources));
    assert.ok(Object.isFrozen(capture.sources[0]));
});

test('detects disk content changes even when a document keeps version 0', () => {
    const root = source('file:///project/Main.P', '#include "types.h"\n', 0);
    const include = source('file:///project/types.h', 'TYPE A FIXED;', 0);
    const files = new MemorySources(root, include);
    const collector = new AnalysisSnapshotCollector(files, logger);
    const capture = collector.collect(root, settings);
    files.files.set(include.uri, { ...include, text: 'TYPE B FLOAT;' });
    assert.deepEqual(collector.changedSources(root, capture), [include.uri]);
});

test('detects a previously missing include being created or found include deleted', () => {
    const root = source('file:///project/Main.P', '#include "found.h"\n#include "missing.h"\n');
    const found = source('file:///project/found.h', 'TYPE Found FIXED;');
    const files = new MemorySources(root, found);
    const collector = new AnalysisSnapshotCollector(files, logger);
    const capture = collector.collect(root, settings);
    files.files.delete(found.uri);
    files.files.set('file:///project/missing.h', source('file:///project/missing.h', 'TYPE New FIXED;'));
    assert.deepEqual(collector.changedSources(root, capture), [found.uri, 'file:///project/missing.h']);
});

test('detects modifications to the root snapshot independently of include versions', () => {
    const root = source('file:///project/Main.P', 'MODULE M; PROBLEM; MODEND;', 3);
    const files = new MemorySources(root);
    const collector = new AnalysisSnapshotCollector(files, logger);
    const capture = collector.collect(root, settings);
    files.files.set(root.uri, { ...root, text: 'MODULE N; PROBLEM; MODEND;' });
    assert.deepEqual(collector.changedSources(root, capture), [root.uri]);
});

test('predefined macros are expanded during capture with identical compiler rules', () => {
    const root = source('file:///project/Main.P', '#include Dir/TYPES.h\n');
    const include = source('file:///project/lib/TYPES.h', 'TYPE A FIXED;');
    const files = new MemorySources(root, include);
    const collector = new AnalysisSnapshotCollector(files, logger);
    const capture = collector.collect(root, { ...settings, macros: { Dir: 'lib' } });
    assert.equal(capture.resolutions[0]?.includePath, 'lib/TYPES.h');
    assert.equal(capture.sources[0]?.uri, include.uri);
});

test('repeated lookup inconsistency aborts rather than combining contradictory sources', () => {
    const root = source('file:///project/Main.P', '#include "a.h"\n#include "a.h"\n');
    const first = source('file:///project/a.h', 'TYPE A FIXED;\n', 1);
    const files = new MemorySources(root, first);
    const realResolve = files.resolveInclude.bind(files);
    let calls = 0;
    files.resolveInclude = (uri, includePath) => {
        if (++calls === 2) files.files.set(first.uri, { ...first, version: 2, text: 'TYPE B FIXED;\n' });
        return realResolve(uri, includePath);
    };
    assert.throws(() => new AnalysisSnapshotCollector(files, logger).collect(root, settings),
        /Source changed during snapshot capture/);
});
