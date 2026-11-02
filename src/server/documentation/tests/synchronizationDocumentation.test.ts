// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { SourceValue } from '../../core/sourceValue';
import { SynchronizationStatementNode } from '../../ast/problem/statements/synchronizationStatementNode';
import { SemaSetStatementNode } from '../../ast/problem/statements/semaSetStatementNode';
import { TryExpressionNode } from '../../ast/problem/expressions/tryExpressionNode';
import { SynchronizationTypeNode } from '../../ast/problem/types/synchronizationTypeNode';

function doc(node: SynchronizationStatementNode | SemaSetStatementNode | TryExpressionNode | SynchronizationTypeNode): string {
    const provider = node.documentationProvider();
    const result = provider.getDocumentation(node as never, { node, element: node.keyword });
    assert.ok(result, `Missing keyword documentation for ${node.keyword.value}`);
    return result;
}

test('synchronization operations describe the expected object kind', () => {
    for (const name of ['REQUEST', 'RELEASE', 'ENTER', 'LEAVE', 'RESERVE', 'FREE']) {
        const node = new SynchronizationStatementNode(SourceValue.synthetic(name), [], []);
        const documentation = doc(node);
        assert.match(documentation, new RegExp(name));
        assert.match(documentation, /SEMA|BOLT/);
        assert.equal(node.documentationProvider().getDocumentation(node, { node, element: SourceValue.synthetic('other') }), undefined);
    }
});

test('SEMASET and TRY document their operands and result', () => {
    assert.match(doc(new SemaSetStatementNode(SourceValue.synthetic('SEMASET'), undefined, undefined, undefined)), /FIXED\(15\)/);
    assert.match(doc(new TryExpressionNode(SourceValue.synthetic('TRY'), undefined)), /BIT\(1\)/);
});

test('synchronization component types provide their own hover', () => {
    for (const kind of ['SEMA', 'BOLT']) {
        assert.match(doc(new SynchronizationTypeNode(SourceValue.synthetic(kind))), /Strukturkomponententyp/);
    }
});
