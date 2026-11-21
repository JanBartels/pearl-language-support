// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import test from 'node:test';
import assert from 'node:assert/strict';
import { SourceValue } from '../../core/sourceValue';
import { ProblemCollection } from '../../core/problemCollection';
import { TranslationUnitNode } from '../../ast/module/translationUnitNode';
import { PreprocessorConditionalBlockCollection } from '../../preproc/preprocessorConditionalBlockCollection';
import { includeOccurrenceId, type IncludeOccurrence, type IncludeSite } from '../../preproc/includeOccurrence';
import { FileSource } from '../../source/fileSource';
import { Analysis } from '../../validation/analysis';
import { AnalysisResult } from '../../validation/analysisResult';
import { definitionNavigationContext, matchesDefinitionTarget } from '../definitionNavigationContext';
import type { DocumentRegistry } from '../../utility/documentRegistry';
import { TextDocument } from 'vscode-languageserver-textdocument';

const main = 'file:///project/Main.P';
const remote = 'file:///home/other/library/unusual.inc';
const nested = 'file:///home/other/library/more/nested.anything';
const rootSource = new FileSource(main, 'MODULE; PROBLEM; MODEND;');
const expanded = new FileSource('file:///expanded-run', ' '.repeat(500));
const externalSource = new FileSource(remote, 'DCL Value FIXED;');
const nestedSource = new FileSource(nested, 'DCL Nested FIXED;');
const site1: IncludeSite = { includingUri: main, directiveOffset: 10, includedUri: remote };
const site2: IncludeSite = { includingUri: main, directiveOffset: 90, includedUri: remote };

function occurrence(sourceUri: string, sites: readonly IncludeSite[], start: number, end: number): IncludeOccurrence {
    return { id: includeOccurrenceId(sites), sourceUri, sites, expandedSpan: { start, end } };
}
function result(occurrences: IncludeOccurrence[]): AnalysisResult {
    const analysis = new Analysis(rootSource, [], new TranslationUnitNode(),
        new ProblemCollection(), [], new PreprocessorConditionalBlockCollection());
    return AnalysisResult.create(analysis, [analysis], [remote, nested], occurrences);
}
function declaration(source = externalSource, lexical = 100): SourceValue<string> {
    return new SourceValue('Value', { source, span: { start: 4, end: 9 } },
        { source: expanded, span: { start: lexical, end: lexical + 5 } });
}

test('a definition selects its exact repeated occurrence, not its physical offset', () => {
    const first = occurrence(remote, [site1], 80, 130);
    const second = occurrence(remote, [site2], 200, 250);
    const analysis = result([first, second]);
    assert.deepEqual(definitionNavigationContext(analysis, declaration(externalSource, 104), remote), {
        uri: remote, unitUri: main, occurrenceId: first.id
    });
    assert.deepEqual(definitionNavigationContext(analysis, declaration(externalSource, 214), remote), {
        uri: remote, unitUri: main, occurrenceId: second.id
    });
});

test('nested external includes retain the full path, independent of extensions and workspace', () => {
    const chain = [site1, { includingUri: remote, directiveOffset: 55, includedUri: nested }];
    const nestedOccurrence = occurrence(nested, chain, 105, 140);
    const analysis = result([occurrence(remote, [site1], 50, 180), nestedOccurrence]);
    const item = declaration(nestedSource, 115);
    const resolved = definitionNavigationContext(analysis, item, nested);
    assert.equal(resolved?.occurrenceId, includeOccurrenceId(chain));
    assert.equal(resolved?.unitUri, main);
});

test('ambiguous or missing lexical origin is never guessed among repeated includes', () => {
    const first = occurrence(remote, [site1], 80, 130);
    const second = occurrence(remote, [site2], 200, 250);
    const analysis = result([first, second]);
    const withoutLexical = new SourceValue('Value', declaration().location);
    assert.equal(definitionNavigationContext(analysis, withoutLexical, remote), undefined);
    assert.equal(definitionNavigationContext(analysis, declaration(externalSource, 400), remote), undefined);
});

test('a single include may be used when no lexical origin exists', () => {
    const only = occurrence(remote, [site1], 80, 130);
    const value = new SourceValue('Value', declaration().location);
    assert.equal(definitionNavigationContext(result([only]), value, remote)?.occurrenceId, only.id);
});

test('definitions in roots or unrelated physical files do not select include contexts', () => {
    const analysis = result([occurrence(remote, [site1], 80, 130)]);
    assert.equal(definitionNavigationContext(analysis, declaration(), main), undefined);
    assert.equal(definitionNavigationContext(analysis, declaration(), 'file:///different.h'), undefined);
});

test('navigation metadata requires a matching actual definition location', () => {
    const value = declaration();
    const doc = TextDocument.create(remote, 'pearl', 0, externalSource.text);
    const registry = { get: (uri: string) => uri === remote ? doc : null } as DocumentRegistry;
    const request = {
        textDocument: { uri: main }, position: { line: 0, character: 0 },
        targetUri: remote, targetStart: { line: 0, character: 4 }
    };
    assert.equal(matchesDefinitionTarget(value, request, registry), true);
    assert.equal(matchesDefinitionTarget(value, {
        ...request, targetStart: { line: 0, character: 5 }
    }, registry), false);
    assert.equal(matchesDefinitionTarget(value, {
        ...request, targetUri: nested
    }, registry), false);
});
