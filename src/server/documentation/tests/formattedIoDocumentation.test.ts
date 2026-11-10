// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { AstLookupResultDocumentationProvider } from '../astLookupResultDocumentationProvider';
import { analyzeFormattedIo } from '../../validation/tests/formattedIoTestFixture';

function documentationFor(result: ReturnType<typeof analyzeFormattedIo>,
    value: { location?: { span: { start: number } } }): string | undefined {
    const hit = result.ast.lookupSourceValue({uri: result.uri, offset: value.location!.span.start});
    assert.ok(hit, 'source value must have an AST lookup');
    return AstLookupResultDocumentationProvider.getDocumentation(hit, result.semantic);
}

test('GET, PUT, CONVERT and format item keywords provide contextual hover', () => {
    const result = analyzeFormattedIo(`
        GET A FROM Disk BY RST(FixedErr1),F(3);
        PUT VarChar20 TO Disk BY A(LEN(VarChar20)),SKIP;
        CONVERT A FROM VarChar20 BY F(4);
    `);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.diagnostics, []);
    for (const statement of result.statements) {
        assert.match(documentationFor(result, statement.keyword) ?? '',
            new RegExp(`^# ${statement.keyword.value}`));
    }
    const aFormat = result.statements[1].formats!.items[0];
    assert.match(documentationFor(result, aFormat.keyword!) ?? '', /^# A/);
    const rstFormat = result.statements[0].formats!.items[0];
    assert.match(documentationFor(result, rstFormat.keyword!) ?? '', /^# RST/);
});

test('R reference and named FORMAT declaration have resolvable documentation', () => {
    const result = analyzeFormattedIo('PUT A TO Disk BY R(Later);', '', 'Later: FORMAT (F(3));');
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.diagnostics, []);
    const reference = result.statements[0].formats!.items[0].reference!.identifier;
    assert.match(documentationFor(result, reference) ?? '', /^# Later/);
    assert.match(documentationFor(result, result.declarations[0].name) ?? '', /^# Later/);
});

test('B1 format keyword provides the same binary-format semantics as B in hover', () => {
    const result = analyzeFormattedIo('PUT VarBit,VarBit TO Disk BY B1(8), B(8);');
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.diagnostics, []);
    const formats = result.statements[0].formats!.items;
    assert.match(documentationFor(result, formats[0].keyword!) ?? '', /^# B1\n/);
    assert.match(documentationFor(result, formats[0].keyword!) ?? '', /identisch mit B/);
    assert.match(documentationFor(result, formats[1].keyword!) ?? '', /^# B\n/);
});

test('formatted I/O hover explains the RTOS-UH restriction on field transfers', () => {
    const result = analyzeFormattedIo(`
        GET Array(1) FROM Disk BY F(5);
        PUT Array(2) TO Disk BY F(5);
        CONVERT Array(3) TO VarChar20 BY F(5);
    `);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.diagnostics, []);
    for (const statement of result.statements) {
        assert.match(documentationFor(result, statement.keyword) ?? '', /keine ganzen Felder|Vollständige Felder/);
    }
});
