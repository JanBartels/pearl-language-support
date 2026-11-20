// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { TextDocuments } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { TranslationUnitNode } from '../../ast/module/translationUnitNode';
import { ProblemCollection } from '../../core/problemCollection';
import { PreprocessorConditionalBlockCollection } from '../../preproc/preprocessorConditionalBlockCollection';
import { FileSource } from '../../source/fileSource';
import { Analysis } from '../../validation/analysis';
import { AnalysisResult } from '../../validation/analysisResult';
import { DocumentRegistry } from '../documentRegistry';

const first = 'file:///project/Module1.P';
const second = 'file:///project/Module2.P';
const include = 'file:///project/Include.h';
const unrelated = 'file:///project/Other.h';

function fixture() {
    const openDocuments = new Map<string, TextDocument>();
    const documents = {
        get: (uri: string) => openDocuments.get(uri),
        all: () => [...openDocuments.values()]
    } as unknown as TextDocuments<TextDocument>;
    const registry = new DocumentRegistry(documents);
    const open = (uri: string, version: number, text = '') => {
        openDocuments.set(uri, TextDocument.create(uri, 'pearl', version, text));
    };
    const analysis = (uri: string, includes: readonly string[] = []): AnalysisResult => {
        const source = new FileSource(uri, 'MODULE; PROBLEM; MODEND;');
        const root = new Analysis(source, [], new TranslationUnitNode(),
            new ProblemCollection(), [], new PreprocessorConditionalBlockCollection());
        return AnalysisResult.create(root, [root], includes);
    };
    return { open, registry, analysis };
}

test('two independent translation units retain distinct analyses', () => {
    const { open, registry, analysis } = fixture();
    open(first, 1);
    open(second, 2);
    const a = analysis(first);
    const b = analysis(second);
    registry.beginAnalysis(first);
    registry.beginAnalysis(second);
    registry.setAnalysisResult(first, 1, a);
    registry.setAnalysisResult(second, 2, b);

    assert.equal(registry.getAnalysisResultForSource(first, 1), a);
    assert.equal(registry.getAnalysisResultForSource(second, 2), b);
    assert.deepEqual(registry.invalidateUri(first), [first]);
    assert.equal(registry.getAnalysisResultForSource(first, 1), undefined);
    assert.equal(registry.getAnalysisResultForSource(second, 2), b);
});

test('an unsaved include edit invalidates both parent units but not unrelated units', () => {
    const { open, registry, analysis } = fixture();
    open(first, 1);
    open(second, 1);
    open(include, 4);
    open(unrelated, 1);
    registry.beginAnalysis(first);
    registry.beginAnalysis(second);
    registry.setAnalysisResult(first, 1, analysis(first, [include]));
    registry.setAnalysisResult(second, 1, analysis(second, [include]));

    assert.equal(registry.getAnalysisResultForSource(include, 4), undefined,
        'a shared include must not have an arbitrary semantic context');
    assert.deepEqual(new Set(registry.invalidateUri(include)), new Set([first, second]));
    assert.equal(registry.getAnalysisResult(first, 1), undefined);
    assert.equal(registry.getAnalysisResult(second, 1), undefined);
    assert.deepEqual(registry.invalidateUri(unrelated), []);
});

test('include version mismatch rejects cached parent analysis even before invalidation', () => {
    const { open, registry, analysis } = fixture();
    open(first, 1);
    open(include, 1, 'old content');
    const a = analysis(first, [include]);
    registry.beginAnalysis(first);
    registry.setAnalysisResult(first, 1, a);
    assert.equal(registry.getAnalysisResultForSource(include, 1), a);

    open(include, 2, 'new content, not yet analyzed');
    assert.equal(registry.getAnalysisResultForSource(include, 2), undefined);
    assert.equal(registry.getAnalysisResult(first, 1), undefined);
});

test('a source removed from the include tree loses its previous parent relation', () => {
    const { open, registry, analysis } = fixture();
    open(first, 1);
    open(include, 1);
    const request1 = registry.beginAnalysis(first);
    registry.setAnalysisResult(first, 1, analysis(first, [include]));
    assert.equal(registry.getAnalysisResultForSource(include, 1)?.includedSourceUris?.[0], include);

    assert.deepEqual(registry.invalidateUri(first), [first]);
    assert.equal(registry.isCurrentAnalysis(first, request1), false);
    registry.beginAnalysis(first);
    registry.setAnalysisResult(first, 1, analysis(first, []));

    assert.equal(registry.getAnalysisResultForSource(include, 1), undefined);
    assert.deepEqual(registry.invalidateUri(include), []);
});

test('an obsolete asynchronous analysis request cannot publish a result', () => {
    const { registry } = fixture();
    const older = registry.beginAnalysis(first);
    const newer = registry.beginAnalysis(first);
    assert.equal(registry.isCurrentAnalysis(first, older), false);
    assert.equal(registry.isCurrentAnalysis(first, newer), true);
    registry.invalidateUri(first);
    assert.equal(registry.isCurrentAnalysis(first, newer), false);
});

test('closing a root removes its dependency membership and cancels pending work', () => {
    const { open, registry, analysis } = fixture();
    open(first, 1);
    open(include, 1);
    const request = registry.beginAnalysis(first);
    registry.setAnalysisResult(first, 1, analysis(first, [include]));
    registry.closeTranslationUnit(first);
    assert.equal(registry.isCurrentAnalysis(first, request), false);
    assert.deepEqual(registry.invalidateUri(include), []);
    assert.equal(registry.getAnalysisResultForSource(include, 1), undefined);
});

test('a settings change invalidates every active translation unit', () => {
    const { open, registry, analysis } = fixture();
    open(first, 1);
    open(second, 1);
    registry.beginAnalysis(first);
    registry.beginAnalysis(second);
    registry.setAnalysisResult(first, 1, analysis(first));
    registry.setAnalysisResult(second, 1, analysis(second));

    assert.deepEqual(new Set(registry.invalidateAllAnalyses()), new Set([first, second]));
    assert.equal(registry.getAnalysisResult(first, 1), undefined);
    assert.equal(registry.getAnalysisResult(second, 1), undefined);
});
