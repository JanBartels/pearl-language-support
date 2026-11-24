// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { PearlSettings } from '../../settings/pearlSettings';
import type { AnalysisSourceSnapshot } from '../analysisSourceSnapshot';
import { AnalysisSnapshotCollector, type SnapshotSourceDocument, type SnapshotSourceProvider } from '../analysisSnapshotCollector';
import { OpenSourceSnapshotVersionBridge } from '../openSourceSnapshotVersionBridge';

const settings: PearlSettings = {
    maxNumberOfProblems: 100, warnOnCharTruncation: true,
    traceServer: 'off', workingDirMode: 'file', macros: {}
};
const logger = { info() {}, warn() {}, error() {} };
const rootUri = 'file:///project/Main.P';
const includeUri = 'file:///project/types.h';
const includeText = 'TYPE Included FIXED;\n';
const rootText = '#include "types.h"\nMODULE Main; PROBLEM; MODEND;';

function snapshot(uri: string, text: string, version = 0, languageId = 'pearl'): AnalysisSourceSnapshot {
    return { uri, version, text, languageId };
}

class MutableSources implements SnapshotSourceProvider {
    readonly files = new Map<string, AnalysisSourceSnapshot>();
    constructor(...sources: AnalysisSourceSnapshot[]) {
        for (const item of sources) this.files.set(item.uri, item);
    }
    get(uri: string): SnapshotSourceDocument | null {
        const current = this.files.get(uri);
        return current ? { ...current, getText: () => current.text } : null;
    }
    resolveIncludeUri(includingUri: string, includePath: string): string {
        return new URL(includePath, includingUri).href;
    }
    resolveInclude(includingUri: string, includePath: string): SnapshotSourceDocument | null {
        return this.get(this.resolveIncludeUri(includingUri, includePath));
    }
    update(item: AnalysisSourceSnapshot): SnapshotSourceDocument {
        this.files.set(item.uri, item);
        return this.get(item.uri)!;
    }
}

function fixture(text = rootText) {
    const root = snapshot(rootUri, text);
    const included = snapshot(includeUri, includeText);
    const files = new MutableSources(root, included);
    const collector = new AnalysisSnapshotCollector(files, logger);
    const capture = collector.collect(root, settings);
    const bridge = new OpenSourceSnapshotVersionBridge();
    const changed = () => collector.changedSources(root, capture, bridge.accepts.bind(bridge));
    return { root, included, files, collector, capture, bridge, changed };
}

test('an actual didOpen of an unchanged disk include preserves an in-flight capture', () => {
    const f = fixture();
    assert.deepEqual(f.changed(), []);
    const opened = f.files.update(snapshot(includeUri, includeText, 1));
    assert.deepEqual(f.collector.changedSources(f.root, f.capture), [includeUri]);
    f.bridge.didOpen(opened);
    // TextDocuments emits a duplicate content callback during didOpen.
    f.bridge.didChangeContent(opened);
    assert.deepEqual(f.changed(), []);
    assert.equal(f.capture.sources[0]?.version, 0);
    assert.equal(f.capture.sources[0]?.text, includeText);
});

test('version bridge is never inferred merely from identical text', () => {
    const f = fixture();
    f.files.update(snapshot(includeUri, includeText, 1));
    assert.deepEqual(f.changed(), [includeUri]);
});

test('didOpen with modified text cannot make an old include result valid', () => {
    const f = fixture();
    f.bridge.didOpen(f.files.update(snapshot(includeUri, includeText + 'DCL X FIXED;', 1)));
    assert.deepEqual(f.changed(), [includeUri]);
});

test('an edit invalidates didOpen proof even if the bytes later return to the original', () => {
    const f = fixture();
    f.bridge.didOpen(f.files.update(snapshot(includeUri, includeText, 1)));
    f.bridge.didChangeContent(f.files.update(snapshot(includeUri, 'TYPE Changed FLOAT;', 2)));
    assert.deepEqual(f.changed(), [includeUri]);
    f.bridge.didChangeContent(f.files.update(snapshot(includeUri, includeText, 3)));
    assert.deepEqual(f.changed(), [includeUri]);
});

test('closing an editor and disk-watch invalidation both revoke adoption', () => {
    const f = fixture();
    f.bridge.didOpen(f.files.update(snapshot(includeUri, includeText, 1)));
    f.bridge.invalidate(includeUri);
    assert.deepEqual(f.changed(), [includeUri]);
    f.bridge.didOpen(f.files.get(includeUri)!);
    assert.deepEqual(f.changed(), []);
    f.bridge.invalidate(includeUri);
    assert.deepEqual(f.changed(), [includeUri]);
});

test('a root document version is always strict, even after identical didOpen', () => {
    const f = fixture();
    f.bridge.didOpen(f.files.update(snapshot(rootUri, rootText, 1)));
    assert.deepEqual(f.changed(), [rootUri]);
});

test('different language IDs and non-disk snapshots cannot be bridged', () => {
    const f = fixture();
    f.bridge.didOpen(f.files.update(snapshot(includeUri, includeText, 1, 'plaintext')));
    assert.deepEqual(f.changed(), [includeUri]);
    const changedVersion = fixture();
    const other = snapshot(includeUri, includeText, 4);
    changedVersion.files.update(other);
    const newerCollector = new AnalysisSnapshotCollector(changedVersion.files, logger);
    const updatedCapture = newerCollector.collect(changedVersion.root, settings);
    changedVersion.bridge.didOpen(changedVersion.files.update(snapshot(includeUri, includeText, 5)));
    assert.deepEqual(newerCollector.changedSources(changedVersion.root, updatedCapture,
        changedVersion.bridge.accepts.bind(changedVersion.bridge)), [includeUri]);
});

test('include resolution and missing targets still invalidate, even with didOpen proof', () => {
    const f = fixture('#include "types.h"\n#include "missing.h"\nMODULE Main; PROBLEM; MODEND;');
    f.bridge.didOpen(f.files.update(snapshot(includeUri, includeText, 1)));
    const missingUri = 'file:///project/missing.h';
    f.files.update(snapshot(missingUri, 'TYPE Missing FIXED;', 1));
    assert.deepEqual(f.changed(), [missingUri]);
    f.files.files.delete(missingUri);
    // A changed resolution mapping is also rejected.
    const oldResolve = f.files.resolveIncludeUri.bind(f.files);
    f.files.resolveIncludeUri = (including, name) => name === 'types.h'
        ? 'file:///project/replaced.h' : oldResolve(including, name);
    assert.deepEqual(new Set(f.changed()), new Set([rootUri, includeUri, 'file:///project/replaced.h']));
});
