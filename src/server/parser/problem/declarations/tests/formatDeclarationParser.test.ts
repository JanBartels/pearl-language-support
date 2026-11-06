// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { parseFormattedIo } from '../../../../validation/tests/formattedIoTestFixture';

test('FORMAT declaration retains nested groups and repeated formats', () => {
    const result = parseFormattedIo('PUT A, B TO Disk BY R(Ftab);',
        'Ftab: FORMAT (X(2),F(8,3),(3)(X(2),E(10,3)));');
    assert.deepEqual(result.syntax, []);
    assert.equal(result.declarations.length, 1);
    assert.equal(result.declarations[0].name.value, 'Ftab');
    const repeated = result.declarations[0].formats!.items[2];
    assert.equal(repeated.group?.items.length, 2);
    assert.ok(repeated.repeatCount);
    assert.equal(result.statements[0].formats!.items[0].reference?.identifier.value, 'Ftab');
});

test('FORMAT declarations are supported in task-local declaration positions', () => {
    const result = parseFormattedIo('Local: FORMAT (F(3)); PUT A TO Disk BY R(Local);');
    assert.deepEqual(result.syntax, []);
    assert.equal(result.declarations.length, 1);
    assert.equal(result.declarations[0].name.value, 'Local');
    assert.equal(result.statements[0].formats!.items[0].reference?.identifier.value, 'Local');
});

test('FORMAT declarations may occur after the statement using R(...)', () => {
    const result = parseFormattedIo('PUT A TO Disk BY R(Later);', '', 'Later: FORMAT (F(3));');
    assert.deepEqual(result.syntax, []);
    assert.equal(result.declarations[0].name.value, 'Later');
    assert.equal(result.statements[0].formats!.items[0].reference?.identifier.value, 'Later');
});
