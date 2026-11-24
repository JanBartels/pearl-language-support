// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { TextDocuments } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { TranslationUnitNode } from '../../ast/module/translationUnitNode';
import { ProblemCollection } from '../../core/problemCollection';
import type { IncludeOccurrence } from '../../preproc/includeOccurrence';
import { PreprocessorConditionalBlockCollection } from '../../preproc/preprocessorConditionalBlockCollection';
import { FileSource } from '../../source/fileSource';
import { Analysis } from '../../validation/analysis';
import { AnalysisResult } from '../../validation/analysisResult';
import { DocumentRegistry } from '../documentRegistry';

const a = 'file:///project/A.P';
const b = 'file:///project/B.P';
const shared = 'file:///external/SHARED_VARS.TYP';
const nested = 'file:///external/NESTED.INC';
const rootText = 'MODULE; PROBLEM; MODEND;';
const includeText = 'DCL Value FIXED GLOBAL;';

function fixture() {
    const openDocs = new Map<string, TextDocument>();
    const docs = {
        get: (uri: string) => openDocs.get(uri),
        all: () => [...openDocs.values()]
    } as unknown as TextDocuments<TextDocument>;
    const registry = new DocumentRegistry(docs);
    const open = (uri: string, version = 1, text = includeText) => {
        const doc = TextDocument.create(uri, 'pearl', version, text);
        openDocs.set(uri, doc);
        return doc;
    };
    const publish = (
        uri: string,
        sources: readonly string[] = [shared],
        watched: readonly string[] = sources
    ): void => {
        const source = new FileSource(uri, rootText);
        const root = new Analysis(source, [], new TranslationUnitNode(),
            new ProblemCollection(), [], new PreprocessorConditionalBlockCollection());
        const occurrences: IncludeOccurrence[] = sources.map((sourceUri, index) => ({
            id: `${uri}#${index}`, sourceUri,
            source: new FileSource(sourceUri, includeText),
            sites: [{ includingUri: uri, directiveOffset: index, includedUri: sourceUri }],
            expandedSpan: { start: index, end: index + 1 }
        }));
        const result = AnalysisResult.create(root, [root], [...new Set(sources)], occurrences, watched);
        registry.beginAnalysis(uri);
        registry.setAnalysisResult(uri, openDocs.get(uri)?.version ?? 0, result);
    };
    open(a, 1, rootText);
    open(b, 1, rootText);
    open(shared);
    open(nested);
    return { registry, open, publish };
}

test('available owners produce exactly the selectable occurrence count', () => {
    const f = fixture();
    f.publish(a);
    f.publish(b);
    const report = f.registry.describeIncludeContextAvailability(shared, 1);
    assert.equal(report.includedOwnerCount, 2);
    assert.equal(report.watchedOwnerCount, 2);
    assert.equal(report.eligibleOwnerCount, 2);
    assert.equal(report.optionCount, f.registry.getIncludeContextOptions(shared, 1).length);
    assert.deepEqual(report.owners.map(owner => owner.status), ['available', 'available']);
});

test('invalidation retains owners but identifies missing committed analyses', () => {
    const f = fixture();
    f.publish(a);
    f.publish(b);
    f.registry.invalidateUri(shared);
    const report = f.registry.describeIncludeContextAvailability(shared, 1);
    assert.equal(report.includedOwnerCount, 2);
    assert.equal(report.optionCount, 0);
    assert.deepEqual(report.owners.map(owner => owner.status), ['analysisMissing', 'analysisMissing']);
});

test('source document version mismatch explains a missing context', () => {
    const f = fixture();
    f.publish(a);
    f.publish(b);
    f.open(shared, 2);
    const report = f.registry.describeIncludeContextAvailability(shared, 2);
    assert.equal(report.optionCount, 0);
    assert.deepEqual(report.owners.map(owner => owner.status), [
        'sourceVersionMismatch', 'sourceVersionMismatch'
    ]);
    assert.equal(report.owners[0]?.recordedSourceVersion, 1);
});

test('unrelated changed include makes one unit stale without hiding the other', () => {
    const f = fixture();
    f.publish(a, [shared, nested]);
    f.publish(b);
    f.open(nested, 2);
    const report = f.registry.describeIncludeContextAvailability(shared, 1);
    assert.equal(report.optionCount, 1);
    assert.equal(report.owners[0]?.status, 'staleSourceVersions');
    assert.deepEqual(report.owners[0]?.staleSources, [{
        uri: nested, recordedVersion: 1, openVersion: 2
    }]);
    assert.equal(report.owners[1]?.status, 'available');
});

test('watch-only dependency is not claimed as an executed include', () => {
    const f = fixture();
    f.publish(a, [], [shared]);
    const report = f.registry.describeIncludeContextAvailability(shared, 1);
    assert.equal(report.includedOwnerCount, 0);
    assert.equal(report.watchedOwnerCount, 1);
    assert.equal(report.optionCount, 0);
    assert.deepEqual(report.owners.map(owner => owner.status), ['watchedButNotIncluded']);
});

test('repeated include occurrences count as multiple contexts from one owner', () => {
    const f = fixture();
    f.publish(a, [shared, shared]);
    const report = f.registry.describeIncludeContextAvailability(shared, 1);
    assert.equal(report.includedOwnerCount, 1);
    assert.equal(report.eligibleOwnerCount, 1);
    assert.equal(report.optionCount, 2);
    assert.equal(report.owners[0]?.optionCount, 2);
    assert.equal(report.optionCount, f.registry.getIncludeContextOptions(shared, 1).length);
});

test('adopted editor version is reported as available', () => {
    const f = fixture();
    f.publish(a);
    f.publish(b);
    const opened = f.open(shared, 2);
    assert.equal(f.registry.tryAdoptSourceDocument(opened), 2);
    const report = f.registry.describeIncludeContextAvailability(shared, 2);
    assert.equal(report.optionCount, 2);
    assert.ok(report.owners.every(owner => owner.recordedSourceVersion === 2));
});
