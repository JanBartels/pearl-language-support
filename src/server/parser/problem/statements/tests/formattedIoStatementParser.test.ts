// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { parseFormattedIo } from '../../../../validation/tests/formattedIoTestFixture';

test('GET/PUT retain all objects and ordered format items including expressions', () => {
    const result = parseFormattedIo(`
        GET VarFixed31, VarBit FROM Disk BY SKIP,RST(FixedErr1),F(3),X,B;
        PUT VarChar20 TO Disk BY A(LEN(VarChar20)),SKIP;
    `);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.statements.map(statement => statement.keyword.value), ['GET', 'PUT']);
    assert.deepEqual(result.statements.map(statement => statement.objects.length), [2, 1]);
    assert.deepEqual(result.statements.map(statement => statement.formats?.items.length), [5, 2]);
    assert.deepEqual(result.statements[0].formats?.items.map(format => format.keyword?.value),
        ['SKIP', 'RST', 'F', 'X', 'B']);
    const lengthArgument = result.statements[1].formats!.items[0].argumentsList[0];
    assert.ok(lengthArgument.getChildren().length > 0, 'LEN(...) must remain an AST expression');
});

test('CONVERT parses both directions and preserves source and target operands', () => {
    const result = parseFormattedIo(`
        CONVERT A, B FROM VarChar20 BY RST(FixedErr1), F(4), E(10,2);
        CONVERT 'Index =', A TO VarChar20 BY A, F(4), X, SKIP;
    `);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.statements.map(statement => statement.directionKeyword?.value), ['FROM', 'TO']);
    assert.deepEqual(result.statements.map(statement => statement.objects.length), [2, 2]);
    assert.ok(result.statements.every(statement => statement.target));
});

test('PUT may have no data and permits variable width arguments', () => {
    const result = parseFormattedIo('PUT TO Disk BY SKIP; PUT A TO Disk BY F(VarFixed31),X(VarFixed31);');
    assert.deepEqual(result.syntax, []);
    assert.equal(result.statements[0].objects.length, 0);
    assert.equal(result.statements[1].formats!.items[0].argumentsList.length, 1);
});

test('nested groups and repeat counts remain structurally represented', () => {
    const result = parseFormattedIo('PUT A TO Disk BY (2)(X(5),F(8)), LIST; GET A FROM Disk BY F(3);');
    assert.deepEqual(result.syntax, []);
    assert.equal(result.statements.length, 2);
    const item = result.statements[0].formats!.items[0];
    assert.equal(item.group?.items.length, 2);
    assert.ok(item.repeatCount);
});

test('GET parses array segments and retains their syntax for semantic validation', () => {
    const result = parseFormattedIo('GET Array(1:3) FROM Disk BY (3)F(4);');
    assert.deepEqual(result.syntax, []);
    assert.equal(result.statements[0].objects[0].dumpLabel(), 'IoSegment');
    assert.match(result.statements[0].formats!.items[0].repeatCount!.dumpLabel(), /^LiteralExpression/);
});

test('empty format argument lists are diagnosed without consuming the next statement', () => {
    const result = parseFormattedIo('PUT A TO Disk BY A(), LIST(); GET A FROM Disk BY F(3);');
    assert.equal(result.statements.length, 2);
    assert.ok(result.syntax.filter(message => message.includes('empty argument list')).length >= 2);
});

test('missing PUT semicolon recovers at the next GET statement', () => {
    const result = parseFormattedIo('PUT A TO Disk BY F(3) GET A FROM Disk BY F(3);');
    assert.equal(result.statements.length, 2);
    assert.ok(result.syntax.some(message => message.includes("Expected ';' after PUT")));
});
