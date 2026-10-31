// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { mapToOriginalLocation } from '../../core/sourceOffset';
import { FileSource } from '../../source/fileSource';
import { ExternalPreprocessorResultBuilder } from '../externalPreprocessorResult';
import type { MacroReference } from '../macroReference';

function location(source: FileSource, start: number, end: number) {
    return { source, span: { start, end } };
}

test('external output preserves adjacent macro fragments without separators', () => {
    const input = new FileSource('file:///test.p', 'WertIst WertEnde');
    const builder = new ExternalPreprocessorResultBuilder(input);
    builder.appendExpansion('/*', location(input, 0, 7));
    builder.appendExpansion(' 0:40 ', location(input, 0, 7));
    builder.appendExpansion('*/', location(input, 8, 16));
    const result = builder.build();
    assert.equal(result.source.text, '/* 0:40 */');
    assert.deepEqual(mapToOriginalLocation({ source: result.source, span: { start: 0, end: 2 } }), location(input, 0, 7));
    assert.deepEqual(mapToOriginalLocation({ source: result.source, span: { start: 8, end: 10 } }), location(input, 8, 16));
});

test('original source ranges and included sources retain independent origins', () => {
    const root = new FileSource('file:///test.p', 'A B');
    const included = new FileSource('file:///header.h', 'xy');
    const builder = new ExternalPreprocessorResultBuilder(root);
    builder.appendOriginal(location(root, 0, 1));
    builder.appendOriginal(location(included, 0, 2));
    builder.appendOriginal(location(root, 2, 3));
    const result = builder.build();
    assert.equal(result.source.text, 'AxyB');
    assert.deepEqual(mapToOriginalLocation({ source: result.source, span: { start: 1, end: 3 } }), location(included, 0, 2));
});

test('macro navigation metadata is preserved independently of output text', () => {
    const input = new FileSource('file:///test.p', 'VAR');
    const builder = new ExternalPreprocessorResultBuilder(input);
    const reference = { definition: {} as MacroReference['definition'], location: location(input, 0, 3) };
    builder.addMacroReference(reference);
    builder.appendExpansion('DCL', reference.location);
    const first = builder.build();
    assert.equal(first.source.text, 'DCL');
    assert.deepEqual(first.macroReferences, [reference]);
    assert.equal(first.conditionalBlocks.length, 0);
    builder.addMacroReference(reference);
    assert.equal(first.macroReferences.length, 1, 'built metadata is a snapshot');
});
