// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { TextDocuments } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { TranslationUnitNode } from '../../ast/module/translationUnitNode';
import { ProblemCollection } from '../../core/problemCollection';
import { PreprocessorConditionalBlockCollection } from '../../preproc/preprocessorConditionalBlockCollection';
import { includeOccurrenceId, type IncludeOccurrence, type IncludeSite } from '../../preproc/includeOccurrence';
import { FileSource } from '../../source/fileSource';
import { Analysis } from '../../validation/analysis';
import { AnalysisResult } from '../../validation/analysisResult';
import { DocumentRegistry } from '../documentRegistry';

const root = 'file:///project/Main.P';
const another = 'file:///project/Another.P';
const shared = 'file:///project/Shared.h';
const outer = 'file:///project/Outer.h';

function occurrence(sites: readonly IncludeSite[], start: number, end: number): IncludeOccurrence {
    return { id: includeOccurrenceId(sites), sourceUri: shared, sites, expandedSpan: { start, end } };
}
const siteA = { includingUri: root, directiveOffset: 11, includedUri: shared };
const siteB = { includingUri: root, directiveOffset: 88, includedUri: shared };

function fixture() {
    const open = new Map<string, TextDocument>();
    const docs = {
        get(uri: string) { return open.get(uri); },
        all() { return [...open.values()]; }
    } as unknown as TextDocuments<TextDocument>;
    const registry = new DocumentRegistry(docs);
    const update = (uri: string, version: number) => open.set(uri, TextDocument.create(uri, 'pearl', version, 'DCL Value FIXED;'));
    for (const uri of [root, another, shared, outer]) update(uri, 1);
    const publish = (uri: string, occurrences: IncludeOccurrence[]) => {
        registry.beginAnalysis(uri);
        const analysis = new Analysis(new FileSource(uri, 'MODULE; PROBLEM; MODEND;'), [],
            new TranslationUnitNode(), new ProblemCollection(), [],
            new PreprocessorConditionalBlockCollection());
        const result = AnalysisResult.create(analysis, [analysis], [shared], occurrences);
        registry.setAnalysisResult(uri, open.get(uri)!.version, result);
        return result;
    };
    return { registry, publish, update };
}

test('two includes within one translation unit require an occurrence selection', () => {
    const { registry, publish } = fixture();
    const first = occurrence([siteA], 20, 37);
    const second = occurrence([siteB], 80, 97);
    const result = publish(root, [first, second]);

    assert.deepEqual(registry.getIncludeContextCandidates(shared, 1), [root]);
    assert.deepEqual(registry.getIncludeContextOptions(shared, 1).map(o => o.occurrence?.id),
        [first.id, second.id]);
    assert.equal(registry.getAnalysisResultForSource(shared, 1), undefined);
    assert.equal(registry.selectIncludeContext(shared, 1, root), false);
    assert.equal(registry.selectIncludeContextOption(shared, 1, root, second.id), true);
    assert.equal(registry.getAnalysisResultForSource(shared, 1), result);
    assert.deepEqual(registry.getSourceLookupPosition(shared, 1, 5), {
        uri: shared, offset: 5, occurrenceSpan: second.expandedSpan
    });
    assert.equal(registry.selectIncludeContextOption(shared, 1, root, first.id), true);
    assert.deepEqual(registry.getSourceLookupPosition(shared, 1, 5).occurrenceSpan, first.expandedSpan);
});

test('occurrence choice survives a newer analysis with shifted expansion ranges', () => {
    const { registry, publish, update } = fixture();
    const first = occurrence([siteA], 20, 37);
    const second = occurrence([siteB], 80, 97);
    publish(root, [first, second]);
    assert.equal(registry.selectIncludeContextOption(shared, 1, root, second.id), true);
    update(shared, 2);
    assert.deepEqual(registry.invalidateUri(shared), [root]);
    assert.equal(registry.getAnalysisResultForSource(shared, 2), undefined);
    const revised = publish(root, [occurrence([siteA], 22, 40), occurrence([siteB], 130, 150)]);
    assert.equal(registry.getAnalysisResultForSource(shared, 2), revised);
    assert.deepEqual(registry.getSourceLookupPosition(shared, 2, 5).occurrenceSpan, {start: 130, end: 150});
});

test('removed occurrence is never silently replaced by a surviving occurrence', () => {
    const { registry, publish, update } = fixture();
    const first = occurrence([siteA], 20, 37);
    const second = occurrence([siteB], 80, 97);
    publish(root, [first, second]);
    registry.selectIncludeContextOption(shared, 1, root, second.id);
    update(shared, 2);
    registry.invalidateUri(shared);
    publish(root, [first]);
    assert.equal(registry.getSelectedIncludeContextOption(shared, 2), undefined);
    assert.equal(registry.getAnalysisResultForSource(shared, 2), undefined);
    assert.equal(registry.selectIncludeContextOption(shared, 2, root, first.id), true);
    assert.equal(registry.getSelectedIncludeContextOption(shared, 2)?.occurrence?.id, first.id);
});

test('nested include paths distinguish identical inner directive positions', () => {
    const { registry, publish } = fixture();
    const pathA = [
        { includingUri: root, directiveOffset: 10, includedUri: outer },
        { includingUri: outer, directiveOffset: 0, includedUri: shared }
    ];
    const pathB = [
        { includingUri: root, directiveOffset: 50, includedUri: outer },
        { includingUri: outer, directiveOffset: 0, includedUri: shared }
    ];
    publish(root, [occurrence(pathA, 1, 20), occurrence(pathB, 21, 40)]);
    const options = registry.getIncludeContextOptions(shared, 1);
    assert.equal(options.length, 2);
    assert.notEqual(options[0].occurrence?.id, options[1].occurrence?.id);
    assert.equal(registry.selectIncludeContextOption(shared, 1, root, options[1].occurrence?.id), true);
    assert.deepEqual(registry.getSourceLookupPosition(shared, 1, 1).occurrenceSpan, {start: 21, end: 40});
});

test('different parents and multiple occurrences share the same selection mechanism', () => {
    const { registry, publish } = fixture();
    const first = occurrence([siteA], 1, 20);
    const second = occurrence([siteB], 21, 40);
    const third = occurrence([{includingUri: another, directiveOffset: 5, includedUri: shared}], 3, 10);
    publish(root, [first, second]);
    const alternate = publish(another, [third]);
    assert.equal(registry.getIncludeContextOptions(shared, 1).length, 3);
    assert.equal(registry.getAnalysisResultForSource(shared, 1), undefined);
    registry.selectIncludeContextOption(shared, 1, another, third.id);
    assert.equal(registry.getAnalysisResultForSource(shared, 1), alternate);
    // One include in the selected unit needs no additional lexical restriction.
    assert.deepEqual(registry.getSourceLookupPosition(shared, 1, 2), {uri: shared, offset: 2});
});

test('legacy analyses without occurrence metadata retain the previous selection contract', () => {
    const { registry, publish } = fixture();
    const result = publish(root, []);
    assert.equal(registry.getAnalysisResultForSource(shared, 1), result);
    assert.deepEqual(registry.getSourceLookupPosition(shared, 1, 3), {uri: shared, offset: 3});
});
