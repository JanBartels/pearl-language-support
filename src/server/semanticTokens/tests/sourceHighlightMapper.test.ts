// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { SourceValue } from '../../core/sourceValue';
import type { Location } from '../../core/location';
import { FileSource } from '../../source/fileSource';
import {
    SourceHighlightAttribute as Attribute,
    SourceHighlightKind as Kind,
    type SourceHighlight
} from '../../semantic/sourceHighlight';
import type { DocumentRegistry } from '../../utility/documentRegistry';
import type { AnalysisResult } from '../../validation/analysisResult';
import { SemanticTokenService } from '../semanticTokenService';
import { SourceHighlightMapper } from '../sourceHighlightMapper';
import { TokenLegend } from '../tokenLegend';

const uri = 'file:///highlight.P';
const legend = new TokenLegend();
const mapper = new SourceHighlightMapper(legend);

function fixture(text: string, uriOverride = uri) {
    const source = new FileSource(uriOverride, text);
    const document = TextDocument.create(uriOverride, 'pearl', 1, text);
    const highlight = (
        word: string,
        kind: Kind,
        attributes: readonly Attribute[] = [],
        offset = text.indexOf(word)
    ): SourceHighlight => ({
        element: new SourceValue(word, {
            source,
            span: { start: offset, end: offset + word.length }
        }),
        kind,
        attributes
    });
    return { source, document, highlight };
}

test('maps unsorted SourceValues to sorted, delta-encoded LSP tokens', () => {
    const { document, highlight } = fixture('TYPE Foo;\nDCL x INV Foo;');
    const result = mapper.map(document, [
        highlight('Foo', Kind.Type, [], 20),
        highlight('x', Kind.DataObject, [Attribute.Declaration, Attribute.Readonly]),
        highlight('TYPE', Kind.Keyword),
        highlight('Foo', Kind.Type, [Attribute.Declaration], 5)
    ]);
    const type = legend.getType('type');
    const keyword = legend.getType('keyword');
    const variable = legend.getType('variable');
    const declaration = legend.getModifierMask(['declaration']);
    const readonlyDeclaration = legend.getModifierMask(['declaration', 'readonly']);
    assert.deepEqual(result.data, [
        0, 0, 4, keyword, 0,
        0, 5, 3, type, declaration,
        1, 4, 1, variable, readonlyDeclaration,
        0, 6, 3, type, 0
    ]);
});

test('deduplicates equal ranges and combines identical classifications attributes', () => {
    const { document, highlight } = fixture('DCL Name FIXED;');
    const result = mapper.map(document, [
        highlight('Name', Kind.DataObject, [Attribute.Declaration]),
        highlight('Name', Kind.DataObject, [Attribute.Readonly]),
        highlight('Name', Kind.DataObject)
    ]);
    assert.deepEqual(result.data, [
        0, 4, 4, legend.getType('variable'),
        legend.getModifierMask(['declaration', 'readonly'])
    ]);
});

test('rejects conflicting and partially overlapping classifications', () => {
    const { source, document, highlight } = fixture('ABCDEF');
    const overlap: SourceHighlight = {
        element: new SourceValue('BCDE', { source, span: { start: 1, end: 5 } }),
        kind: Kind.Operator
    };
    const result = mapper.map(document, [
        overlap,
        highlight('ABCDEF', Kind.Type),
        highlight('ABCDEF', Kind.DataObject)
    ]);
    assert.deepEqual(result.data, []);
});

test('does not emit other source files, invalid offsets, synthetic values or multiline tokens', () => {
    const { source, document, highlight } = fixture('A\nB');
    const other = fixture('Other', 'file:///other.P');
    const bad: SourceHighlight[] = [
        other.highlight('Other', Kind.Type),
        { element: SourceValue.synthetic('A'), kind: Kind.Type },
        { element: new SourceValue('broken', {source, span: {start: -1, end: 1}}), kind: Kind.Type },
        { element: new SourceValue('A\nB', {source, span: {start: 0, end: 3}}), kind: Kind.Type }
    ];
    assert.deepEqual(mapper.map(document, bad).data, []);
    assert.deepEqual(mapper.map(document, [...bad, highlight('B', Kind.DataObject)]).data,
        [1, 0, 1, legend.getType('variable'), 0]);
});

test('does not paint the physical macro invocation as the generated identifier', () => {
    const { source, document } = fixture('DCL X MY_TYPE;');
    const physical: Location = {source, span: {start: 6, end: 13}};
    const expanded: SourceHighlight = {
        element: new SourceValue('FIXED', physical, physical),
        kind: Kind.Keyword
    };
    assert.deepEqual(mapper.map(document, [expanded]).data, []);
});

test('service reads the newest analysis rather than caching by document URI', async () => {
    const { document, highlight } = fixture('Name');
    let current: readonly SourceHighlight[] = [highlight('Name', Kind.Type)];
    const registry = {
        get: () => document,
        getAnalysisResultForSource: () => ({rootAnalysis: {sourceHighlights: current}} as AnalysisResult)
    } as unknown as DocumentRegistry;
    const service = new SemanticTokenService(registry,
        {info() {}, warn() {}, error() {}}, legend);
    const params = {textDocument: {uri}};
    assert.equal((await service.handleFull(params)).data[3], legend.getType('type'));
    current = [highlight('Name', Kind.DataObject)];
    assert.equal((await service.handleFull(params)).data[3], legend.getType('variable'));
    current = [];
    assert.deepEqual((await service.handleFull(params)).data, []);
});

test('uses original source offsets and UTF-16 positions, including CRLF', () => {
    const { document, highlight } = fixture('/*😀*/ A;\r\nDCL B;');
    const result = mapper.map(document, [
        highlight('B', Kind.DataObject),
        highlight('A', Kind.DataObject)
    ]);
    assert.deepEqual(result.data, [
        0, 7, 1, legend.getType('variable'), 0,
        1, 4, 1, legend.getType('variable'), 0
    ]);
});

test('uses a source mapping to its original document rather than expanded offsets', () => {
    const { source, document } = fixture('DCL Name;');
    const expandedSource = {
        uri: 'file:///expanded', text: 'Name', length: 4,
        getText: () => 'Name',
        mapLocation: () => ({ source, span: {start: 4, end: 8} })
    };
    const expanded: SourceHighlight = {
        element: new SourceValue('Name', {
            source: expandedSource,
            span: {start: 0, end: 4}
        }), kind: Kind.DataObject
    };
    assert.deepEqual(mapper.map(document, [expanded]).data,
        [0, 4, 4, legend.getType('variable'), 0]);
});

test('service returns no classifications when no matching analysis exists yet', async () => {
    const { document } = fixture('Name');
    const registry = {
        get: () => document,
        getAnalysisResultForSource: () => undefined
    } as unknown as DocumentRegistry;
    const service = new SemanticTokenService(registry,
        {info() {}, warn() {}, error() {}}, legend);
    assert.deepEqual((await service.handleFull({textDocument: {uri}})).data, []);
});
