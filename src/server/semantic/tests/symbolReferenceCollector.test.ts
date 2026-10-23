// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { AstKind } from '../../ast/astKind';
import type { AstNode } from '../../ast/astNode';
import type { SourceValue } from '../../core/sourceValue';
import { SymbolReferenceCollector } from '../symbolReferenceCollector';
import { SymbolReferenceKind } from '../symbolReference';
import { SourceValue as RealSourceValue } from '../../core/sourceValue';
import { NamedTypeNode } from '../../ast/problem/types/namedTypeNode';
import { RefTypeNode } from '../../ast/problem/types/refTypeNode';

// The collector only needs the syntactic fields and getChildren(). Using
// small AST doubles keeps these tests independent of parser/Source details.
function identifier(value: string): SourceValue<string> {
    return {
        value,
        location: { source: { uri: 'file:///test.pearl' }, span: { start: 0, end: value.length } }
    } as unknown as SourceValue<string>;
}

function node(
    kind: AstKind,
    properties: object = {},
    children: readonly AstNode[] = []
): AstNode {
    return {
        kind,
        ...properties,
        getChildren: () => children
    } as unknown as AstNode;
}

test('records syntactic uses, but not declaration names', () => {
    const declared = identifier('T');
    const typeUse = identifier('T');
    const call = identifier('Run');
    const jump = identifier('Next');
    const fixed = identifier('Count');
    const init = identifier('Target');
    const shellName = identifier('Start');

    const tree = node(AstKind.TranslationUnit, {}, [
        node(AstKind.TypeDeclaration, { name: declared }),
        node(AstKind.NamedType, { name: typeUse }),
        node(AstKind.CallStatement, { target: call, argumentsList: [] }),
        node(AstKind.GotoStatement, { target: jump }),
        node(AstKind.ConstantFixedFactor, { operand: { kind: 'identifier', identifier: fixed } }),
        node(AstKind.InitElement, { value: { kind: 'identifier', identifier: init } }),
        node(AstKind.ShellCommand, { procedureName: shellName }),
    ]);

    const index = new SymbolReferenceCollector().collect(tree);
    assert.equal(index.all.length, 6);
    assert.equal(index.lookup(declared), undefined);
    assert.equal(index.lookup(typeUse)?.kind, SymbolReferenceKind.Type);
    assert.equal(index.lookup(call)?.kind, SymbolReferenceKind.Call);
    assert.equal(index.lookup(jump)?.kind, SymbolReferenceKind.JumpTarget);
    assert.equal(index.lookup(fixed)?.kind, SymbolReferenceKind.Read);
    assert.equal(index.lookup(init)?.kind, SymbolReferenceKind.Initialization);
    assert.equal(index.lookup(shellName)?.kind, SymbolReferenceKind.ShellEntryPoint);
});

test('retains unresolved references and does not depend on a binding index', () => {
    const missing = identifier('MissingProcedure');
    const tree = node(AstKind.CallStatement, { target: missing });
    const index = new SymbolReferenceCollector().collect(tree);
    assert.equal(index.lookup(missing)?.identifier, missing);
});

test('does not infer references from unparsed expression token text', () => {
    const token = identifier('LooksLikeAName');
    const root = node(AstKind.TranslationUnit, {}, [
        node(AstKind.CallStatement, { target: identifier('P'), argumentsList: [[token]] }),
        node(AstKind.ReturnStatement, { expression: [token] }),
        node(AstKind.IfStatement, { conditionTokens: [token] }),
    ]);
    const index = new SymbolReferenceCollector().collect(root);
    assert.equal(index.all.length, 1);
    assert.equal(index.lookup(token), undefined);
});

test('keeps distinct SourceValues distinct even when names or editor positions coincide', () => {
    const first = identifier('X');
    const second = identifier('X');
    const child1 = node(AstKind.NamedType, { name: first });
    const child2 = node(AstKind.NamedType, { name: second });
    const index = new SymbolReferenceCollector().collect(node(AstKind.TranslationUnit, {}, [child1, child2]));
    assert.equal(index.all.length, 2);
    assert.notEqual(index.lookup(first), index.lookup(second));
});

test('ignores synthetic recovery placeholders without a location', () => {
    const placeholder = { value: '<error>', location: undefined } as SourceValue<string>;
    const index = new SymbolReferenceCollector().collect(node(AstKind.GotoStatement, { target: placeholder }));
    assert.equal(index.all.length, 0);
});

test('records optional END names without confusing control variable declarations with uses', () => {
    const blockEnd = identifier('Outer');
    const repeatEnd = identifier('Loop');
    const control = identifier('i');
    const index = new SymbolReferenceCollector().collect(node(AstKind.TranslationUnit, {}, [
        node(AstKind.Block, { endIdentifier: blockEnd }),
        node(AstKind.Repetition, { endIdentifier: repeatEnd }, [
            node(AstKind.RepetitionForClause, { variable: control })
        ])
    ]));
    assert.equal(index.lookup(blockEnd)?.kind, SymbolReferenceKind.BlockEnd);
    assert.equal(index.lookup(repeatEnd)?.kind, SymbolReferenceKind.RepetitionEnd);
    assert.equal(index.lookup(control), undefined);
});


test('visits a named type through the corrected REF target AST', () => {
    const name = new RealSourceValue('Node', {
        source: { uri: 'file:///test.pearl' },
        span: { start: 12, end: 16 }
    } as unknown as NonNullable<SourceValue<string>['location']>);
    const refType = new RefTypeNode(
        RealSourceValue.synthetic('REF'),
        new NamedTypeNode(name)
    );

    const index = new SymbolReferenceCollector().collect(refType);
    assert.equal(index.all.length, 1);
    assert.equal(index.lookup(name)?.kind, SymbolReferenceKind.Type);
});
