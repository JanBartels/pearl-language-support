// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { SourceValue } from '../../core/sourceValue';
import { BasicTransferStatementNode } from '../../ast/problem/statements/basicTransferStatementNode';

function hover(keyword: 'TAKE' | 'SEND'): string {
    const token = new SourceValue(keyword);
    const node = new BasicTransferStatementNode(token, [], [], undefined,
        undefined, undefined, undefined);
    return node.documentationProvider().getDocumentation(node, {
        node, element: token
    }) ?? '';
}

test('TAKE hover documents whole ARRAY acceptance and STRUCT/slice restrictions', () => {
    const text = hover('TAKE');
    assert.match(text, /vollständige Felder/);
    assert.match(text, /mehrdimensionaler Felder/);
    assert.match(text, /nicht jedoch einzelne vollständige Strukturen/);
});

test('SEND hover explains whole ARRAY rejection and scalar element acceptance', () => {
    const text = hover('SEND');
    assert.match(text, /Vollständige Felder, Strukturen und Feld-Ausschnitte/);
    assert.match(text, /einzelne Feldelemente/);
});
