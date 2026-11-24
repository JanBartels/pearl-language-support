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

const root1 = 'file:///project/Unit1.P';
const root2 = 'file:///project/Unit2.P';
const shared = 'file:///outside/Shared.TYP';
const nested = 'file:///outside/Nested.INC';
const sourceText = '#define VAR "SPC"\nVAR External FIXED GLOBAL;\n';
const unitText = 'MODULE; PROBLEM; MODEND;';

function fixture() {
    const openDocs = new Map<string, TextDocument>();
    const docs = {
        get: (uri: string) => openDocs.get(uri),
        all: () => [...openDocs.values()]
    } as unknown as TextDocuments<TextDocument>;
    const registry = new DocumentRegistry(docs);
    const open = (uri: string, version: number, text: string): TextDocument => {
        const doc = TextDocument.create(uri, 'pearl', version, text);
        openDocs.set(uri, doc);
        return doc;
    };
    const publish = (
        uri: string,
        includes: readonly { uri: string; text?: string }[] = [],
        watches: readonly string[] = includes.map(item => item.uri)
    ): AnalysisResult => {
        const source = new FileSource(uri, unitText);
        const analysis = new Analysis(source, [], new TranslationUnitNode(),
            new ProblemCollection(), [], new PreprocessorConditionalBlockCollection());
        const occurrences: IncludeOccurrence[] = includes.map((item, index) => ({
            id: `${uri}#${index}`,
            sourceUri: item.uri,
            ...(item.text === undefined ? {} : { source: new FileSource(item.uri, item.text) }),
            sites: [{ includingUri: uri, directiveOffset: index, includedUri: item.uri }],
            expandedSpan: { start: index, end: index + 1 }
        }));
        const result = AnalysisResult.create(analysis, [analysis],
            includes.map(item => item.uri), occurrences, watches);
        registry.beginAnalysis(uri);
        registry.setAnalysisResult(uri, openDocs.get(uri)?.version ?? 0, result);
        return result;
    };
    return { registry, open, publish };
}

test('opening an unchanged shared include adopts the new editor version for all roots', () => {
    const f = fixture();
    f.open(root1, 0, unitText);
    f.open(root2, 0, unitText);
    f.open(shared, 0, sourceText);
    const a = f.publish(root1, [{ uri: shared, text: sourceText }]);
    const b = f.publish(root2, [{ uri: shared, text: sourceText }]);
    const aRequest = f.registry.beginAnalysis(root1);
    const bRequest = f.registry.beginAnalysis(root2);

    const document = f.open(shared, 1, sourceText);
    assert.deepEqual(f.registry.getIncludeContextCandidates(shared, 1), []);
    assert.equal(f.registry.tryAdoptSourceDocument(document), 2);
    assert.deepEqual(f.registry.getIncludeContextCandidates(shared, 1), [root1, root2]);
    assert.equal(f.registry.getAnalysisResult(root1, 0), a);
    assert.equal(f.registry.getAnalysisResult(root2, 0), b);
    assert.equal(f.registry.isCurrentAnalysis(root1, aRequest), true);
    assert.equal(f.registry.isCurrentAnalysis(root2, bRequest), true);
});

test('an unsaved edit is not adopted; both roots still require invalidation', () => {
    const f = fixture();
    f.open(root1, 0, unitText);
    f.open(root2, 0, unitText);
    f.open(shared, 0, sourceText);
    f.publish(root1, [{ uri: shared, text: sourceText }]);
    f.publish(root2, [{ uri: shared, text: sourceText }]);

    const changed = f.open(shared, 1, sourceText + 'DCL Added FIXED;\n');
    assert.equal(f.registry.tryAdoptSourceDocument(changed), 0);
    assert.deepEqual(new Set(f.registry.invalidateUri(shared)), new Set([root1, root2]));
    assert.equal(f.registry.getAnalysisResult(root1, 0), undefined);
});

test('mixed include snapshots do not partially adopt a new source version', () => {
    const f = fixture();
    f.open(root1, 0, unitText);
    f.open(root2, 0, unitText);
    f.open(shared, 0, sourceText);
    f.publish(root1, [{ uri: shared, text: sourceText }]);
    f.publish(root2, [{ uri: shared, text: sourceText + 'changed' }]);

    const document = f.open(shared, 1, sourceText);
    assert.equal(f.registry.tryAdoptSourceDocument(document), 0);
    assert.deepEqual(f.registry.getIncludeContextCandidates(shared, 1), []);
});

test('nested include and repeated physical snapshots are all verified', () => {
    const f = fixture();
    f.open(root1, 0, unitText);
    f.open(nested, 0, sourceText);
    f.publish(root1, [
        { uri: nested, text: sourceText },
        { uri: nested, text: sourceText }
    ]);
    assert.equal(f.registry.tryAdoptSourceDocument(f.open(nested, 1, sourceText)), 1);
    assert.deepEqual(f.registry.getIncludeContextCandidates(nested, 1), [root1]);

    f.open(nested, 2, sourceText);
    f.publish(root2, [{ uri: nested, text: 'a different snapshot' }]);
    assert.equal(f.registry.tryAdoptSourceDocument(f.open(nested, 3, sourceText)), 0);
});

test('previously missing watch targets cannot be adopted without a source snapshot', () => {
    const f = fixture();
    f.open(root1, 0, unitText);
    f.publish(root1, [], [shared]);
    assert.equal(f.registry.tryAdoptSourceDocument(f.open(shared, 1, sourceText)), 0);
    assert.deepEqual(f.registry.invalidateUri(shared), [root1]);
});

test('a stale second open input prevents adoption of only one changed source', () => {
    const f = fixture();
    f.open(root1, 0, unitText);
    f.open(shared, 0, sourceText);
    f.open(nested, 0, 'original nested');
    f.publish(root1, [
        { uri: shared, text: sourceText },
        { uri: nested, text: 'original nested' }
    ]);
    f.open(nested, 1, 'modified nested');
    assert.equal(f.registry.tryAdoptSourceDocument(f.open(shared, 1, sourceText)), 0);
    assert.equal(f.registry.getAnalysisResult(root1, 0), undefined);
});

test('opening an unchanged translation unit rebinds its root version', () => {
    const f = fixture();
    f.open(root1, 0, unitText);
    const result = f.publish(root1);
    assert.equal(f.registry.tryAdoptSourceDocument(f.open(root1, 1, unitText)), 1);
    assert.equal(f.registry.getAnalysisResult(root1, 1), result);
    assert.equal(f.registry.getAnalysisResult(root1, 0), undefined);
    assert.equal(f.registry.tryAdoptSourceDocument(f.open(root1, 2, unitText + ' ')), 0);
});

test('legacy analyses without physical include snapshots always fall back to reanalysis', () => {
    const f = fixture();
    f.open(root1, 0, unitText);
    f.open(shared, 0, sourceText);
    f.publish(root1, [{ uri: shared }]);
    assert.equal(f.registry.tryAdoptSourceDocument(f.open(shared, 1, sourceText)), 0);
});
