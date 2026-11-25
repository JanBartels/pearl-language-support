// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { DocumentRegistry } from '../../documentRegistry';
import type { WorkspaceManager } from '../../workspace';
import type { PearlSettings } from '../../../settings/pearlSettings';
import { Validator } from '../../../validation/validator';
import { SourceValue } from '../../../core/sourceValue';
import { FileSource } from '../../../source/fileSource';
import { SourceOffset } from '../../../core/sourceOffset';
import { TranslationUnitNode } from '../../../ast/module/translationUnitNode';
import { ModuleNode } from '../../../ast/module/moduleNode';
import { ProblemPartNode } from '../../../ast/problem/problemPartNode';
import { DclDeclarationNode } from '../../../ast/problem/declarations/dclDeclarationNode';
import { DclDeclarationSentenceNode } from '../../../ast/problem/declarations/dclDeclarationSentenceNode';
import { OneIdentifierOrListNode } from '../../../ast/problem/identifiers/oneIdentifierOrListNode';
import { ProblemDataAttributeNode } from '../../../ast/problem/declarations/problemDataAttributeNode';
import { SimpleTypeNode } from '../../../ast/problem/types/simpleTypeNode';
import { AstNode } from '../../../ast/astNode';
import { AstKind } from '../../../ast/astKind';
import { AstGraphEncoder, decodeAstGraph, encodeAstGraph, type AstGraphWire } from '../astGraphTransport';

const settings: PearlSettings = {
    traceServer: 'off', maxNumberOfProblems: 100, warnOnCharTruncation: true, macros: {}
};

function preorder(n: AstNode): readonly string[] {
    return [`${AstKind[n.kind]}:${n.dumpLabel()}`, ...n.getChildren().flatMap(preorder)];
}

function assertParentLinks(root: AstNode): void {
    for (const child of root.getChildren()) {
        assert.equal(child.parent, root, `parent of ${child.dumpLabel()}`);
        assertParentLinks(child);
    }
}

test('roundtrip restores real AST constructors, parent links and documentation providers', async () => {
    const document = TextDocument.create('file:///tree.P', 'pearl', 1,
        'MODULE Tree; PROBLEM; DCL X FIXED; TYPE Record STRUCT[ Y FIXED ]; MODEND;');
    const validator = new Validator({} as WorkspaceManager,
        { resolveInclude: () => null } as unknown as DocumentRegistry,
        { info() {}, warn() {}, error() {} });
    const result = await validator.analyze(document, settings);
    const original = result.rootAnalysis.ast;
    const wire = structuredClone(encodeAstGraph(original, [result.rootAnalysis.source]));
    assert.deepEqual(JSON.parse(JSON.stringify(wire)), wire);
    const decoded = decodeAstGraph(wire);
    assert.ok(decoded.root instanceof TranslationUnitNode);
    assert.deepEqual(preorder(decoded.root), preorder(original));
    assertParentLinks(decoded.root);
    assert.equal(decoded.sourceValues.sources.roots.length, 1);
    assert.equal(decoded.sourceValues.sources.roots[0]!.text, result.rootAnalysis.source.text);
    const module = decoded.root.getChildren()[0]!;
    assert.ok(module instanceof ModuleNode);
    assert.equal(typeof module.documentationProvider(), 'object');
    const problem = module.getChildren().find(child => child instanceof ProblemPartNode);
    assert.ok(problem instanceof ProblemPartNode);
    assert.ok(problem.getChildren().some(child => child instanceof DclDeclarationNode));
    const point = document.getText().indexOf('FIXED') + 1;
    const position: SourceOffset = {uri: document.uri, offset: point};
    const originalFound = original.lookupSourceValue(position);
    const restoredFound = decoded.root.lookupSourceValue(position);
    assert.equal(restoredFound?.node.kind, originalFound?.node.kind);
    assert.equal(restoredFound?.element.value, originalFound?.element.value);
    assert.notEqual(restoredFound?.element, originalFound?.element);
    assert.equal(restoredFound?.element.location?.source.uri, document.uri);
});

test('shared SourceValue identities and AST ID references are preserved', () => {
    const source = new FileSource('file:///a.p', 'MODULE Demo; PROBLEM; DCL X FIXED; MODEND;');
    const sv = (text: string, start: number) => new SourceValue(text, {
        source, span: {start, end: start + text.length}
    });
    const shared = sv('X', 26);
    const module = new ModuleNode(sv('MODULE', 0), sv('Demo', 7));
    const problem = new ProblemPartNode(sv('PROBLEM', 13));
    const type = new SimpleTypeNode(sv('FIXED', 28), undefined);
    const attr = new ProblemDataAttributeNode(undefined, type, undefined, undefined);
    const decl = new DclDeclarationNode(sv('DCL', 22), [
        new DclDeclarationSentenceNode(new OneIdentifierOrListNode(false, [shared, shared]), undefined, attr)
    ]);
    problem.addChild(decl);
    module.problemPart = module.adopt(problem);
    const root = new TranslationUnitNode();
    root.addChild(module);
    const encoder = new AstGraphEncoder();
    const rootId = encoder.encode(root);
    const wire = structuredClone(encoder.finish(root, [source]));
    assert.equal(rootId, wire.rootId);
    const restored = decodeAstGraph(wire).root as TranslationUnitNode;
    const restoredModule = restored.children[0] as ModuleNode;
    const restoredProblem = restoredModule.problemPart!;
    const restoredDecl = restoredProblem.children[0] as DclDeclarationNode;
    const restoredIdentifiers = restoredDecl.declarations[0]!.identifiers.identifiers;
    assert.equal(restoredIdentifiers[0], restoredIdentifiers[1]);
    assert.equal(restoredModule.parent, restored);
    assert.equal(restoredDecl.parent, restoredProblem);
    assert.equal(restoredDecl.declarations[0]!.parent, restoredDecl);
});

test('malformed AST version, identities and dangling node references are rejected', () => {
    const root = new TranslationUnitNode();
    const wire = encodeAstGraph(root);
    assert.throws(() => decodeAstGraph({...wire,version:2} as unknown as AstGraphWire), /version/);
    assert.throws(() => decodeAstGraph({...wire,rootId:123}), /Missing AST/);
    assert.throws(() => decodeAstGraph({...wire,nodes:[...wire.nodes,wire.nodes[0]!]}), /duplicate/);
    assert.throws(() => decodeAstGraph({...wire,nodes:[{...wire.nodes[0]!,extras:{children:{tag:'array',elements:[{tag:'node',id:99}]}}}]}), /Missing AST/);
});

test('unsupported AST kinds reject rather than creating prototype-less nodes', () => {
    const wire = encodeAstGraph(new TranslationUnitNode());
    const node = {...wire.nodes[0]!,kind:AstKind.Operator};
    assert.throws(() => decodeAstGraph({...wire,nodes:[node]}), /Unsupported AST kind/);
});

test('real parser AST retains name, REF, STRUCT and TYPE subtrees including source lookup', async () => {
    const text = `MODULE Strong; PROBLEM;
DCL R1 REF FIXED;
DCL R2 REF Person;
DCL R3 REF STRUCT[ Value FIXED ];
DCL R4 REF STRUCT[];
TYPE Node STRUCT[ Value FIXED, Next REF Node ];
TYPE Counter FIXED;
MODEND;`;
    const document = TextDocument.create('file:///strong.P', 'pearl', 1, text);
    const validator = new Validator({} as WorkspaceManager,
        { resolveInclude: () => null } as unknown as DocumentRegistry,
        { info() {}, warn() {}, error() {} });
    const result = await validator.analyze(document, settings);
    const root = result.rootAnalysis.ast;
    const roundtrip = decodeAstGraph(structuredClone(encodeAstGraph(root, [result.rootAnalysis.source])));
    assert.deepEqual(preorder(roundtrip.root), preorder(root));
    assertParentLinks(roundtrip.root);
    for (const word of ['R1', 'R2', 'Person', 'Value', 'Next', 'Counter']) {
        const offset = text.indexOf(word) + 1;
        const pos: SourceOffset = {uri: document.uri, offset};
        const expected = root.lookupSourceValue(pos);
        const actual = roundtrip.root.lookupSourceValue(pos);
        assert.equal(actual?.node.kind, expected?.node.kind, `kind for ${word}`);
        assert.equal(actual?.element.value, expected?.element.value, `value for ${word}`);
    }
});

test('nested constant FIXED and variant INIT node reconstruct their behavior', () => {
    const { ConstantFixedFactorNode } = require('../../../ast/problem/expressions/constantFixedFactorNode') as typeof import('../../../ast/problem/expressions/constantFixedFactorNode');
    const { ConstantFixedTermNode } = require('../../../ast/problem/expressions/constantFixedTermNode') as typeof import('../../../ast/problem/expressions/constantFixedTermNode');
    const { ConstantFixedExpressionNode } = require('../../../ast/problem/expressions/constantFixedExpressionNode') as typeof import('../../../ast/problem/expressions/constantFixedExpressionNode');
    const { InitElementNode } = require('../../../ast/problem/declarations/initElementNode') as typeof import('../../../ast/problem/declarations/initElementNode');
    const { InitializationAttributeNode } = require('../../../ast/problem/declarations/initializationAttributeNode') as typeof import('../../../ast/problem/declarations/initializationAttributeNode');
    const file = new FileSource('file:///init.P', 'INIT (3+5)');
    const value = (v:string, start:number) => new SourceValue(v, {source:file,span:{start,end:start+v.length}});
    const factor = (v:string,at:number) => new ConstantFixedFactorNode(undefined,
        {kind:'integer',literal:value(v,at),precision:undefined},undefined);
    const firstTerm = new ConstantFixedTermNode(factor('3',6), []);
    const secondTerm = new ConstantFixedTermNode(factor('5',8), []);
    const expression = new ConstantFixedExpressionNode(firstTerm,[{operator:value('+',7),term:secondTerm}]);
    const root = new InitializationAttributeNode(value('INIT',0), [
        new InitElementNode({kind:'constantFixedExpression',expression})
    ]);
    const restored = decodeAstGraph(structuredClone(encodeAstGraph(root,[file]))).root as typeof root;
    assert.ok(restored instanceof InitializationAttributeNode);
    assertParentLinks(restored);
    assert.deepEqual(preorder(restored),preorder(root));
    const match = restored.lookupSourceValue({uri:file.uri,offset:8});
    assert.equal(match?.element.value,'5');
    assert.ok(match?.node instanceof ConstantFixedFactorNode);
});
