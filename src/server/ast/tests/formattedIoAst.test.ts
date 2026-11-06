// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { parseFormattedIo } from '../../validation/tests/formattedIoTestFixture';

test('AST source lookup reaches the name inside A(LEN(name))', () => {
    const result = parseFormattedIo('PUT VarChar20 TO Disk BY A(LEN(VarChar20)),SKIP;');
    assert.deepEqual(result.syntax, []);
    const item = result.statements[0].formats!.items[0];
    const argument = item.argumentsList[0] as any;
    const identifier = argument.segments[0].suffix.expressions[0].segments[0].identifier;
    const hit = result.ast.lookupSourceValue({uri: result.uri, offset: identifier.location.span.start});
    assert.equal(hit?.element, identifier);
    assert.equal(hit?.element.value, 'VarChar20');
    assert.equal(result.statements[0].formats!.items[0].keyword?.value, 'A');
});

test('AST source lookup distinguishes FORMAT declaration and R reference', () => {
    const result = parseFormattedIo('PUT A TO Disk BY R(Ftab);', 'Ftab: FORMAT (F(7));');
    assert.deepEqual(result.syntax, []);
    const declaration = result.declarations[0];
    const reference = result.statements[0].formats!.items[0].reference!;
    const declarationHit = result.ast.lookupSourceValue({
        uri: result.uri, offset: declaration.name.location!.span.start });
    const referenceHit = result.ast.lookupSourceValue({
        uri: result.uri, offset: reference.identifier.location!.span.start });
    assert.equal(declarationHit?.element, declaration.name);
    assert.equal(referenceHit?.element, reference.identifier);
    assert.notEqual(referenceHit?.element, declarationHit?.element);
});

test('AST traversal keeps nested format groups available to later semantic passes', () => {
    const result = parseFormattedIo('PUT A TO Disk BY (2)(SKIP,F(6),X(2)),LIST;');
    assert.deepEqual(result.syntax, []);
    const nested = result.statements[0].formats!.items[0].group!;
    assert.deepEqual(nested.items.map(item => item.keyword?.value), ['SKIP', 'F', 'X']);
    const visited: string[] = [];
    const walk = (node: {dumpLabel(): string; getChildren(): readonly any[]}) => {
        visited.push(node.dumpLabel());
        for (const child of node.getChildren()) walk(child);
    };
    walk(result.statements[0]);
    assert.ok(visited.some(label => label.startsWith('Format(F')));
    assert.ok(visited.some(label => label.startsWith('Format(X')));
});
