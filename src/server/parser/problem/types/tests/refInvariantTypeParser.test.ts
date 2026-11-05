// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { AstNode } from '../../../../ast/astNode';
import { RefTypeNode } from '../../../../ast/problem/types/refTypeNode';
import { ReferenceArrayTargetNode } from '../../../../ast/problem/types/referenceArrayTargetNode';
import { ProblemDataAttributeNode } from '../../../../ast/problem/declarations/problemDataAttributeNode';
import { ProblemCollection } from '../../../../core/problemCollection';
import { Lexer } from '../../../../lexer/lexer';
import { Parser } from '../../../parser';
import { ConditionalStack } from '../../../../preproc/conditionalStack';
import { MacroTable } from '../../../../preproc/macroTable';
import { Preprocessor } from '../../../../preproc/preprocessor';
import { PreprocessorContext } from '../../../../preproc/preprocessorContext';
import { PreprocessorConditionalBlockCollection } from '../../../../preproc/preprocessorConditionalBlockCollection';
import { PreprocessorConditionalBlockStack } from '../../../../preproc/preprocessorConditionalBlockStack';
import { SemanticAnalyzer } from '../../../../semantic/semanticAnalyzer';
import { SemanticDiagnosticSeverity } from '../../../../semantic/semanticDiagnostic';
import { SemanticTypeKind } from '../../../../semantic/semanticType';
import { SymbolKind } from '../../../../semantic/symbolKind';
import { FileSource } from '../../../../source/fileSource';
import type { DocumentRegistry } from '../../../../utility/documentRegistry';
import type { Logger } from '../../../../utility/logging/logger';

const logger: Logger = { info() {}, warn() {}, error() {} };

function parse(code: string) {
    const source = new FileSource('file:///ref-inv-test.P',
        `MODULE RefInvTest; PROBLEM; ${code} MODEND;`);
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, logger).tokenize();
    const context = new PreprocessorContext(
        {} as DocumentRegistry,
        new MacroTable(),
        new ConditionalStack(),
        new PreprocessorConditionalBlockStack()
    );
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const ast = new Parser(stream, problems, logger).parse();
    const refs: RefTypeNode[] = [];
    const attributes: ProblemDataAttributeNode[] = [];
    function visit(node: AstNode): void {
        if (node instanceof RefTypeNode) refs.push(node);
        if (node instanceof ProblemDataAttributeNode) attributes.push(node);
        node.getChildren().forEach(visit);
    }
    visit(ast);
    return { source, ast, problems, refs, attributes };
}

test('DCL RIS REF INV STRUCT[] preserves INV as a REF-target qualifier', () => {
    const input = 'DCL RIS REF INV STRUCT[];';
    const result = parse(input);
    assert.deepEqual(result.problems.toArray().map(p => p.message), []);
    assert.equal(result.refs.length, 1);
    assert.equal(result.refs[0].targetInv?.value, 'INV');
    assert.equal(result.attributes[0]?.inv, undefined);
    assert.equal(result.refs[0].dumpLabel(), 'RefType(INV)');

    const invOffset = result.source.text.indexOf('REF INV') + 'REF '.length;
    const lookup = result.ast.lookupSourceValue({uri: result.source.uri, offset: invOffset});
    assert.equal(lookup?.node, result.refs[0]);
    assert.equal(lookup?.element, result.refs[0].targetInv);

    const semantics = new SemanticAnalyzer().analyze(result.ast);
    assert.deepEqual(semantics.diagnostics
        .filter(d => d.severity === SemanticDiagnosticSeverity.Error)
        .map(d => d.message), []);
});

test('INV REF and REF INV are distinct positions in the AST', () => {
    const result = parse('DCL X INV REF INV FIXED INIT(NIL);');
    assert.deepEqual(result.problems.toArray().map(p => p.message), []);
    assert.equal(result.refs[0].targetInv?.value, 'INV');
    assert.equal(result.attributes[0]?.inv?.value, 'INV');
});

test('ordinary REF types and bare REF STRUCT[] remain unchanged', () => {
    const result = parse('DCL R1 REF STRUCT[], R2 REF FIXED, R3 REF INV FLOAT;');
    assert.deepEqual(result.problems.toArray().map(p => p.message), []);
    assert.equal(result.refs.length, 3);
    assert.equal(result.refs[0].targetInv, undefined);
    assert.equal(result.refs[1].targetInv, undefined);
    assert.equal(result.refs[2].targetInv?.value, 'INV');
});

test('SPC reference parameters accept target INV', () => {
    const result = parse('SPC Read ENTRY(REF INV STRUCT[]) GLOBAL;');
    assert.deepEqual(result.problems.toArray().map(p => p.message), []);
    assert.equal(result.refs[0]?.targetInv?.value, 'INV');
});

test('a missing target after REF INV still produces a parser diagnostic', () => {
    const result = parse('DCL RIS REF INV;');
    assert.ok(result.problems.some(p => p.message === "Expected referenced type after 'REF'."));
});


test('REF () INV FIXED and REF (,) INV FLOAT preserve the post-dimension qualifier', () => {
    const result = parse('DCL P REF () INV FIXED, Q REF (,) INV FLOAT;');
    assert.deepEqual(result.problems.toArray().map(p => p.message), []);
    assert.equal(result.refs.length, 2);
    assert.ok(result.refs[0].target instanceof ReferenceArrayTargetNode);
    assert.equal(result.refs[0].target.dimensions.rank, 1);
    assert.equal(result.refs[0].targetInv?.value, 'INV');
    assert.ok(result.refs[1].target instanceof ReferenceArrayTargetNode);
    assert.equal(result.refs[1].target.dimensions.rank, 2);
    assert.equal(result.refs[1].targetInv?.value, 'INV');
    assert.equal(result.attributes[0]?.inv, undefined);

    const invOffset = result.source.text.indexOf('() INV') + '() '.length;
    const lookup = result.ast.lookupSourceValue({ uri: result.source.uri, offset: invOffset });
    assert.equal(lookup?.node, result.refs[0]);
    assert.equal(lookup?.element, result.refs[0].targetInv);

    const semantic = new SemanticAnalyzer().analyze(result.ast);
    assert.deepEqual(semantic.diagnostics
        .filter(d => d.severity === SemanticDiagnosticSeverity.Error)
        .map(d => d.message), []);
    const objects = [...semantic.bindings.values()].filter(s => s.kind === SymbolKind.DataObject);
    for (const name of ['P', 'Q']) {
        const object = objects.find(s => s.name.value === name);
        assert.ok(object && object.kind === SymbolKind.DataObject);
        assert.equal(object.type.kind, SemanticTypeKind.Reference);
        if (object.type.kind === SemanticTypeKind.Reference) {
            assert.equal(object.type.targetInvariant, true);
            assert.equal(object.type.target.kind, SemanticTypeKind.VirtualArray);
        }
    }
});

test('REF virtual dimensions accept INV as a target qualifier in procedure parameters', () => {
    const result = parse('SPC Fetch ENTRY(REF () INV FIXED) GLOBAL;');
    assert.deepEqual(result.problems.toArray().map(p => p.message), []);
    assert.equal(result.refs[0]?.targetInv?.value, 'INV');
    assert.ok(result.refs[0]?.target instanceof ReferenceArrayTargetNode);
});

test('REF () INV still requires an element type', () => {
    const result = parse('DCL P REF () INV;');
    assert.ok(result.problems.some(p => p.message === "Expected referenced type after 'REF'."));
});

test('duplicate INV around virtual dimensions remains a syntax error', () => {
    const result = parse('DCL P REF INV () INV FIXED;');
    assert.ok(result.problems.some(p => p.message === "Duplicate 'INV' qualifier in REF type."));
});
