// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { DocumentRegistry } from '../../utility/documentRegistry';
import type { Analysis } from '../../validation/analysis';
import { findReferences } from '../../lsp/findReferences';
import { lookupSymbolDefinition } from '../bindingIndex';
import { analyzeFormattedIo } from '../../validation/tests/formattedIoTestFixture';

test('RST reports and names in A(LEN(...)) bind to their declarations', () => {
    const result = analyzeFormattedIo(`
        GET VarFixed31 FROM Disk BY RST(FixedErr1),F(3);
        PUT VarChar20 TO Disk BY A(LEN(VarChar20)),SKIP;
    `);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.diagnostics, []);
    const status = result.statements[0].formats!.items[0].argumentsList[0] as any;
    assert.equal(result.semantic.bindings.get(status.segments[0].identifier)?.name.value, 'FixedErr1');
    const lengthArg = result.statements[1].formats!.items[0].argumentsList[0] as any;
    const name = lengthArg.segments[0].suffix.expressions[0].segments[0].identifier;
    assert.equal(result.semantic.bindings.get(name)?.name.value, 'VarChar20');
    assert.ok(result.occurrences.lookup(name)?.references.length);
    const hit = result.ast.lookupSourceValue({uri: result.uri, offset: name.location.span.start});
    assert.equal(lookupSymbolDefinition(result.semantic.bindings, hit!.element)?.value, 'VarChar20');
});

test('FORMAT R references participate in definition lookup and occurrence index', () => {
    const result = analyzeFormattedIo('PUT A TO Disk BY R(Ftab);',
        'Ftab: FORMAT (X(2),F(8,3),(3)(X(2),E(10,3)));');
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.diagnostics, []);
    const name = result.statements[0].formats!.items[0].reference!.identifier;
    assert.equal(result.semantic.bindings.get(name)?.name, result.declarations[0].name);
    const hit = result.ast.lookupSourceValue({uri: result.uri, offset: name.location!.span.start});
    assert.equal(lookupSymbolDefinition(result.semantic.bindings, hit!.element), result.declarations[0].name);
    assert.equal(result.occurrences.lookup(name)?.references.length, 1);
});

test('findReferences returns the data-list and the nested LEN format argument use', () => {
    const result = analyzeFormattedIo('PUT VarChar20 TO Disk BY A(LEN(VarChar20)),SKIP;');
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.diagnostics, []);
    const positions = (offset: number) => {
        const lines = result.text.slice(0, offset).split('\n');
        return {line: lines.length - 1, character: lines[lines.length - 1].length};
    };
    const registry = {get: (uri: string) => uri === result.uri ? {
        positionAt: positions,
        offsetAt: (position: {line: number; character: number}) =>
            result.text.split('\n').slice(0, position.line)
                .reduce((sum, line) => sum + line.length + 1, 0) + position.character,
        getText: () => result.text
    } : null} as unknown as DocumentRegistry;
    const lengthArg = result.statements[0].formats!.items[0].argumentsList[0] as any;
    const name = lengthArg.segments[0].suffix.expressions[0].segments[0].identifier;
    const references = findReferences({symbolOccurrences: result.occurrences} as Analysis,
        result.uri, positions(name.location.span.start), false, registry);
    assert.equal(references.length, 2);
});

test('GET array segment retains its bound field symbol', () => {
    const result = analyzeFormattedIo('GET Array(1:3) FROM Disk BY (3)F(4);');
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.diagnostics, []);
    const segment = result.statements[0].objects[0] as any;
    assert.equal(result.semantic.bindings.get(segment.array.segments[0].identifier)?.name.value, 'Array');
});
