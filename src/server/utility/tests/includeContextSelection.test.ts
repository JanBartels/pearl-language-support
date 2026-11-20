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

const a = 'file:///project/Declaration.P';
const b = 'file:///project/Specification.P';
const include = 'file:///project/Shared.h';
const other = 'file:///project/Other.h';

function fixture() {
    const docs = new Map<string, TextDocument>();
    const documents = {
        get: (uri: string) => docs.get(uri),
        all: () => [...docs.values()]
    } as unknown as TextDocuments<TextDocument>;
    const registry = new DocumentRegistry(documents);
    const open = (uri: string, version = 1) => docs.set(uri, TextDocument.create(uri, 'pearl', version, ''));
    const analysis = (uri: string, includes: string[] = []): AnalysisResult => {
        const root = new Analysis(new FileSource(uri, 'MODULE; PROBLEM; MODEND;'), [],
            new TranslationUnitNode(), new ProblemCollection(), [],
            new PreprocessorConditionalBlockCollection());
        return AnalysisResult.create(root, [root], includes);
    };
    const publish = (uri: string, includes: string[] = []) => {
        registry.beginAnalysis(uri);
        const result = analysis(uri, includes);
        registry.setAnalysisResult(uri, docs.get(uri)?.version ?? 1, result);
        return result;
    };
    open(a); open(b); open(include); open(other);
    return { registry, open, publish };
}

test('shared header requires selection and offers both actually analyzed contexts', () => {
    const { registry, publish } = fixture();
    const declaration = publish(a, [include]);
    const specification = publish(b, [include]);

    assert.deepEqual(registry.getIncludeContextCandidates(include, 1), [a, b]);
    assert.equal(registry.getAnalysisResultForSource(include, 1), undefined);
    assert.equal(registry.getSelectedIncludeContext(include, 1), undefined);

    assert.equal(registry.selectIncludeContext(include, 1, a), true);
    assert.equal(registry.getAnalysisResultForSource(include, 1), declaration);
    assert.equal(registry.getSelectedIncludeContext(include, 1), a);

    assert.equal(registry.selectIncludeContext(include, 1, b), true);
    assert.equal(registry.getAnalysisResultForSource(include, 1), specification);
    assert.equal(registry.getSelectedIncludeContext(include, 1), b);
});

test('reject selecting a translation unit which does not include this source', () => {
    const { registry, publish } = fixture();
    publish(a, [include]); publish(b, [other]);
    assert.equal(registry.selectIncludeContext(include, 1, b), false);
    assert.equal(registry.getSelectedIncludeContext(include, 1), a);
});

test('uniquely included headers need no explicit selection', () => {
    const { registry, publish } = fixture();
    const result = publish(a, [include]);
    assert.deepEqual(registry.getIncludeContextCandidates(include, 1), [a]);
    assert.equal(registry.getAnalysisResultForSource(include, 1), result);
});

test('an explicit context remains stable while both includers are invalidated', () => {
    const { registry, open, publish } = fixture();
    publish(a, [include]); publish(b, [include]);
    registry.selectIncludeContext(include, 1, b);

    open(include, 2);
    assert.deepEqual(new Set(registry.invalidateUri(include)), new Set([a, b]));
    const revisedA = publish(a, [include]);
    // The previously selected B is not fresh yet. Never show A's semantics.
    assert.equal(registry.getAnalysisResultForSource(include, 2), undefined);
    const revisedB = publish(b, [include]);
    assert.notEqual(revisedB, revisedA);
    assert.equal(registry.getAnalysisResultForSource(include, 2), revisedB);
    assert.equal(registry.getSelectedIncludeContext(include, 2), b);
});

test('a second incomplete includer cannot cause arbitrary context selection', () => {
    const { registry, open, publish } = fixture();
    publish(a, [include]); publish(b, [include]);
    open(include, 2);
    registry.invalidateUri(include);
    publish(a, [include]);
    assert.deepEqual(registry.getIncludeContextCandidates(include, 2), [a]);
    assert.equal(registry.getAnalysisResultForSource(include, 2), undefined);
});

test('when the chosen root stops including a source, the remaining root becomes unique', () => {
    const { registry, publish } = fixture();
    publish(a, [include]);
    const second = publish(b, [include]);
    registry.selectIncludeContext(include, 1, a);
    registry.invalidateUri(a);
    publish(a, []);

    assert.deepEqual(registry.getIncludeContextCandidates(include, 1), [b]);
    assert.equal(registry.getSelectedIncludeContext(include, 1), b);
    assert.equal(registry.getAnalysisResultForSource(include, 1), second);
});

test('closing a chosen root keeps the remaining inclusion usable', () => {
    const { registry, publish } = fixture();
    publish(a, [include]);
    const second = publish(b, [include]);
    registry.selectIncludeContext(include, 1, a);
    registry.closeTranslationUnit(a);

    assert.deepEqual(registry.getIncludeContextCandidates(include, 1), [b]);
    assert.equal(registry.getAnalysisResultForSource(include, 1), second);
});

test('include selections are independent for different physical files', () => {
    const { registry, publish } = fixture();
    publish(a, [include, other]);
    publish(b, [include, other]);
    registry.selectIncludeContext(include, 1, a);
    registry.selectIncludeContext(other, 1, b);
    assert.equal(registry.getSelectedIncludeContext(include, 1), a);
    assert.equal(registry.getSelectedIncludeContext(other, 1), b);
});
